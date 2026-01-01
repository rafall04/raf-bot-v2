# Panduan Update Production

## Cara Update (Simpel)

```bash
# Di server production, jalankan:
node scripts/update-production.js

# Lalu restart:
pm2 restart raf-bot
```

Selesai! Script akan otomatis:
1. Backup database
2. Git pull dari GitHub
3. Install dependencies baru (jika ada)
4. Jalankan migrasi database (jika ada)

## Opsi Tambahan

```bash
# Skip backup (lebih cepat)
node scripts/update-production.js --no-backup

# Skip npm install (jika yakin tidak ada package baru)
node scripts/update-production.js --no-install

# Skip keduanya
node scripts/update-production.js --no-backup --no-install
```

## File yang AMAN (Tidak Tertimpa)

File-file ini ada di `.gitignore`, jadi tidak akan tertimpa saat update:

| Kategori | File |
|----------|------|
| Database | `database/*.sqlite` |
| Akun | `database/accounts.json` |
| Request | `database/requests.json`, `database/reports.json` |
| Template | `database/message_templates.json` |
| Config | `.env`, `config.json` |

## Rollback Jika Bermasalah

```bash
# Lihat commit terakhir
git log --oneline -5

# Kembali ke commit sebelumnya
git checkout <commit-hash>

# Restart
pm2 restart raf-bot
```

## Tips

- Selalu test fitur baru di lokal sebelum push ke GitHub
- Backup otomatis tersimpan di folder `backups/`
- Cek log jika ada error: `pm2 logs raf-bot`
