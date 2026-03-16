# Ideas

Tempat mencatat hasil brainstorming untuk proyek ini.

## Brainstorming

### Masalah yang ingin diselesaikan

- Bikin timeline / gantt chart manual di Excel terasa lambat dan tidak menyenangkan.
- Update progress makan waktu karena harus ubah warna satu-satu.
- Legend warna juga harus dirawat manual.
- Ada dua sumber kerja:
  - timeline utama di Microsoft Excel Online,
  - update progres kecil di spreadsheet lain.
- Akibatnya kerja jadi dobel kiri-kanan dan rawan tidak sinkron.

### Ide solusi

Bikin aplikasi internal sederhana untuk mencatat task lalu otomatis menampilkan dalam bentuk tabel / timeline HTML.

### Konsep input

User cukup menulis format singkat seperti ini:

```txt
nama kolom1|2|3|4
migrasiFunctionA;m|fileA,fileB,fileC,fileD|status|deskripsi
```

### Aturan parsing yang dibayangkan

- Pemisah `|` berarti pindah ke field / area data baru.
- Pemisah `,` berarti item pecahan di dalam satu bagian, misalnya daftar file atau daftar kolom waktu.
- Penanda `;m` berarti cell sebelumnya perlu di-merge otomatis.
- Panjang merge mengikuti jumlah item terkait, misalnya mengikuti jumlah kolom hasil pecahan koma.

### Hasil render yang diharapkan

- Setelah disimpan, data langsung jadi tabel HTML.
- Bisa dipakai untuk bikin visual timeline yang lebih cepat dibanding Excel manual.
- Merge cell dilakukan otomatis.
- Warna status dilakukan otomatis berdasarkan nilai status.
- Legend dibuat otomatis dari daftar status yang dipakai.
- Hasil akhirnya bisa diexport ke Excel dalam bentuk tabel yang tetap rapi dan cukup enak dipakai.

### Contoh interpretasi

Input:

```txt
Task|Week 1,Week 2,Week 3,Week 4|Status|Deskripsi
Migrasi Function A;m|fileA,fileB,fileC,fileD|in_progress|Pindah logic lama ke service baru
```

Interpretasi:

- `Task` adalah nama task.
- `Week 1` sampai `Week 4` jadi kolom timeline.
- `Migrasi Function A;m` berarti nama task di-merge sepanjang 4 kolom timeline.
- `fileA,fileB,fileC,fileD` bisa dipakai sebagai isi per kolom timeline, atau jadi acuan panjang merge.
- `in_progress` otomatis diberi warna sesuai mapping status.

### Fitur inti MVP

- Input teks cepat berbasis format sederhana.
- Parser dari teks ke struktur tabel.
- Render tabel HTML.
- Merge cell otomatis.
- Mapping warna berdasarkan status.
- Legend status otomatis.
- Edit dan save ulang tanpa perlu atur warna manual.

### Fitur lanjutan yang penting

- Export ke Excel dari hasil tabel yang sudah dirender.
- Usahakan merge cell, warna dasar status, dan struktur tabel tetap terbawa dengan layak saat export.
- Output Excel ditujukan untuk kebutuhan sharing ke tim yang masih bekerja di Excel.

### Pertanyaan desain yang perlu diputuskan

- Apakah `|` dipakai sebagai pemisah kolom atau pemisah row.
- Apakah `,` selalu berarti sub-kolom timeline, atau kadang hanya daftar biasa.
- Apakah `;m` hanya merge horizontal, atau nanti juga perlu vertical merge.
- Apakah target akhirnya hanya tabel timeline, atau benar-benar gantt chart visual.
- Apakah data disimpan sebagai teks mentah, JSON hasil parsing, atau keduanya.
- Apakah skala timeline memakai per hari, per minggu, atau per bulan.

### Opsi skala timeline

#### Per hari

Cocok untuk:

- task pendek,
- sprint harian,
- kebutuhan yang sangat detail.

Kelebihan:

- paling presisi,
- enak untuk monitoring progres harian.

Kekurangan:

- tabel cepat jadi lebar,
- berat dirawat kalau task banyak,
- kurang enak untuk planning jangka menengah dan panjang.

#### Per minggu

Cocok untuk:

- mayoritas project internal,
- planning implementasi feature,
- progres yang butuh detail tapi tetap ringkas.

Kelebihan:

- cukup detail,
- tetap nyaman dibaca,
- cocok untuk timeline kerja tim.

Kekurangan:

- kurang presisi untuk task yang berubah harian,
- kadang terlalu kasar untuk task yang selesai dalam 1-2 hari.

#### Per bulan

Cocok untuk:

- roadmap,
- planning kuartalan,
- ringkasan progres level manajemen.

Kelebihan:

- sangat ringkas,
- cocok untuk tampilan jangka panjang.

Kekurangan:

- terlalu kasar untuk eksekusi harian,
- kurang cocok buat tracking task teknis detail.

### Rekomendasi yang paling enak

Untuk versi awal, yang paling masuk akal adalah:

- default pakai skala `per minggu`,
- tapi tetap sediakan opsi ganti mode ke `per hari` atau `per bulan`.

Alasannya:

- per minggu paling seimbang antara detail dan kerapian,
- tabel tidak terlalu lebar,
- cocok untuk mayoritas kebutuhan tracking development,
- lebih nyaman saat nanti diexport ke Excel.

### Ide bentuk pengaturan

User bisa set:

- `mode timeline`: day / week / month
- `start date`: tanggal mulai timeline
- `duration`: jumlah slot timeline yang ingin ditampilkan

Contoh:

```txt
mode:week
start:2026-03-01
duration:8
```

Artinya:

- tabel pakai skala mingguan,
- mulai dari minggu pertama Maret 2026,
- tampilkan 8 slot minggu.

### Arah implementasi yang nyaman

Untuk produk awal:

- jadikan skala timeline sebagai pengaturan global per dokumen,
- jangan per row dulu.

Jadi semua task dalam satu tabel mengikuti skala yang sama. Ini lebih simpel untuk:

- parser,
- render HTML,
- merge cell,
- export ke Excel.

Nanti kalau produk sudah matang, baru bisa dipikirkan:

- zoom in / zoom out timeline,
- switch tampilan hari-minggu-bulan,
- summary bulanan dari data mingguan.

### Alternatif konsep timeline yang terasa lebih natural

Ada pendekatan lain yang mungkin justru lebih enak dipakai:

- user pilih dulu `range tanggal` lewat input date,
- sistem langsung generate kolom timeline otomatis,
- default tampilan adalah `harian`,
- semua cell timeline awalnya berwarna putih,
- lalu task akan mengisi slot tanggal tertentu dan cell terkait otomatis diberi warna.

### Alur penggunaan yang dibayangkan

1. User pilih tanggal mulai dan tanggal akhir.
2. Sistem membuat kolom tanggal secara otomatis.
3. Semua slot timeline awalnya kosong / putih.
4. User membuat task.
5. User menentukan task itu aktif di tanggal atau range tanggal mana.
6. Sistem memberi warna otomatis pada cell timeline yang sesuai.

### Contoh perilaku

Misalnya user pilih range:

- mulai: `2026-03-01`
- akhir: `2026-03-07`

Maka tabel timeline otomatis punya kolom:

- `1 Mar`
- `2 Mar`
- `3 Mar`
- `4 Mar`
- `5 Mar`
- `6 Mar`
- `7 Mar`

Kalau ada task yang durasinya 1 hari di `3 Mar`, maka:

- semua cell lain tetap putih,
- cell `3 Mar` untuk task itu berubah warna, misalnya biru.

Kalau task jalan dari `3 Mar` sampai `5 Mar`, maka:

- tiga cell itu otomatis diwarnai,
- cell lain tetap kosong / putih.

### Keunggulan pendekatan ini

- lebih visual,
- lebih gampang dipahami user non-teknis,
- terasa dekat dengan cara orang membayangkan timeline di Excel,
- tidak perlu menulis format timeline yang rumit secara manual.

### Implikasi desain data

Kalau memakai model ini, tiap task idealnya punya field seperti:

- `task name`
- `start date`
- `end date`
- `duration`
- `status`
- `description`
- `color`

Minimal untuk versi awal:

- `task name`
- `start date`
- `end date`
- `status`

### Perilaku default yang bagus

- mode default: `daily`
- warna default semua slot: putih
- durasi default task baru: `1 hari`
- warna default task aktif: biru

Jadi saat user bikin task baru:

- cukup isi nama task,
- pilih tanggal mulai,
- kalau tidak isi tanggal akhir, otomatis dianggap 1 hari,
- sistem langsung warnai 1 cell timeline.

### Kombinasi terbaik untuk MVP

Untuk versi awal, kemungkinan paling nyaman adalah gabungkan dua hal ini:

- input task tetap sederhana dalam bentuk tabel/form,
- timeline tidak diketik manual, tapi digenerate dari range tanggal.

Jadi:

- metadata timeline diatur dari date picker,
- data task diisi lewat row-row tabel,
- render warna timeline dilakukan otomatis.

### Arah rekomendasi terbaru

Kalau melihat kebutuhan praktisnya, versi MVP yang paling kuat mungkin bukan parser teks penuh di awal, tapi:

- pilih range tanggal,
- generate timeline harian otomatis,
- input task per baris,
- warnai cell otomatis berdasarkan start dan end date,
- baru setelah itu ditambah mode input teks cepat kalau memang masih dibutuhkan.

### Arah yang terasa masuk akal

Versi pertama sebaiknya fokus ke:

- text-to-table parser,
- render HTML table,
- auto merge,
- auto color status,
- auto legend.

Kalau itu sudah enak dipakai, baru lanjut ke:

- drag and drop,
- export Excel yang lebih polished,
- sinkronisasi spreadsheet,
- tampilan gantt chart yang lebih visual.
