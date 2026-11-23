#!/usr/bin/env bash
# Memantau database panel admin dan menerbitkan perubahan ke website.
# Pukul 05.00–23.00 WITA: memeriksa tiap ±45 detik selama ±50 menit, lalu
# menyambung dirinya sendiri. Di luar jam itu: sekali periksa saja (jadwal per jam).
set -u
WITA_JAM=$(( (10#$(date -u +%H) + 8) % 24 ))
AKTIF=0; [ "$WITA_JAM" -ge 5 ] && [ "$WITA_JAM" -lt 23 ] && AKTIF=1
AKHIR=$(( $(date +%s) + ${DURASI:-3000} ))

git config user.name "Panel Admin"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

terbitkan() {
  git add -A _data _posts
  git commit -q -m "Perbarui isi dari panel admin"
  for coba in 1 2 3; do
    if git pull -q --rebase && git push -q; then
      gh api -X POST "repos/$GITHUB_REPOSITORY/pages/builds" > /dev/null 2>&1 || true
      echo "$(date -u +%T) Diterbitkan."
      return 0
    fi
    git rebase --abort 2>/dev/null || true
    sleep 5
  done
  echo "$(date -u +%T) Gagal mengirim; diulang pada pemeriksaan berikutnya."
  git reset -q --hard origin/main
}

while :; do
  git pull -q --rebase 2>/dev/null || { git rebase --abort 2>/dev/null; git reset -q --hard origin/main; }
  node scripts/sinkron.mjs | grep -v '^Konten:\|^Berita:\|tidak ada perubahan' || true
  if [ -n "$(git status --porcelain -- _data _posts)" ]; then terbitkan; fi
  [ "$AKTIF" = 1 ] && [ "$(date +%s)" -lt "$AKHIR" ] || break
  sleep 45
done

# Sambung pemantauan berikutnya (GitHub mengizinkan workflow_dispatch dari token bawaan)
if [ "$AKTIF" = 1 ] && [ "${SAMBUNG:-1}" = 1 ]; then
  gh api -X POST "repos/$GITHUB_REPOSITORY/actions/workflows/sinkron.yml/dispatches" -f ref=main > /dev/null \
    && echo "Pemantauan berikutnya dijadwalkan." || echo "Gagal menyambung; jadwal per jam tetap berjalan."
fi
