export default function Privacy() {
  return (
    <div className="page">
      <h1>Dasar Privasi e-OPR</h1>
      <p className="home-subtitle">SABK MAAHAD AL-KHAIR LIL BANAT</p>

      <section>
        <h2>1. Pengenalan</h2>
        <p>
          e-OPR ialah sistem dalaman sekolah yang digunakan untuk menyediakan, menyimpan dan
          menguruskan One Page Report (OPR) bagi kegunaan SABK Maahad Al-Khair Lil Banat. Dasar
          Privasi ini menerangkan bagaimana maklumat diproses apabila sistem digunakan.
        </p>
      </section>

      <section>
        <h2>2. Maklumat yang Diproses</h2>
        <p>
          Sistem memproses maklumat yang dimasukkan oleh pengguna semasa menghasilkan OPR,
          termasuk maklumat program, tarikh, masa, tempat, kumpulan sasaran, maklumat laporan
          (seperti objektif, ringkasan aktiviti, kekuatan, kelemahan dan penambahbaikan), nama
          penyedia dan pengesah, serta gambar dokumentasi program yang dimuat naik. Sistem tidak
          memproses atau mengumpul maklumat lain di luar apa yang dimasukkan secara langsung oleh
          pengguna melalui borang OPR.
        </p>
      </section>

      <section>
        <h2>3. Penggunaan Google Drive</h2>
        <p>
          e-OPR menggunakan Google Drive API untuk tujuan penyimpanan dan pengurusan fail PDF OPR
          yang dihasilkan oleh sistem. Akses Google Drive digunakan semata-mata untuk fungsi
          berkaitan penyimpanan fail e-OPR.
        </p>
        <p>
          Integrasi ini berfungsi secara server-side. Guru yang menggunakan e-OPR untuk
          menghasilkan OPR tidak diminta log masuk ke akaun Google mereka sendiri dan tidak perlu
          memberikan sebarang akses Google peribadi. Kebenaran (authorization) Google Drive
          diberikan oleh satu akaun penyimpanan yang dikendalikan oleh pentadbir sistem.
        </p>
      </section>

      <section>
        <h2>Penggunaan Google API</h2>
        <p>e-OPR menggunakan Google Drive API dengan skop yang terhad seperti berikut:</p>
        <ul>
          <li>Akses digunakan untuk menyimpan dan menguruskan fail PDF OPR yang dihasilkan sistem.</li>
          <li>Akses Google diberikan oleh satu akaun penyimpanan yang dikendalikan oleh pentadbir sistem.</li>
          <li>Guru biasa yang menggunakan e-OPR tidak perlu memberikan akses kepada akaun Google mereka.</li>
          <li>Data yang diterima melalui Google API tidak digunakan untuk tujuan pengiklanan dan tidak dijual kepada pihak ketiga.</li>
        </ul>
      </section>

      <section>
        <h2>4. Penggunaan Data Google</h2>
        <p>
          Data yang diperoleh melalui Google API hanya digunakan untuk menyediakan fungsi Google
          Drive yang diperlukan oleh e-OPR, iaitu penyimpanan dan pengurusan fail PDF OPR. Data
          Google tidak digunakan untuk tujuan pengiklanan, tidak dijual kepada pihak ketiga, dan
          tidak digunakan untuk sebarang tujuan lain yang tidak berkaitan dengan fungsi e-OPR.
        </p>
      </section>

      <section>
        <h2>5. Penyimpanan dan Keselamatan</h2>
        <p>
          Langkah keselamatan yang munasabah digunakan untuk melindungi maklumat dan fail yang
          diproses oleh sistem. Walau bagaimanapun, tiada sistem yang boleh menjamin keselamatan
          mutlak, dan e-OPR berusaha secara berterusan untuk mengekalkan amalan keselamatan yang
          sesuai bagi melindungi data pengguna.
        </p>
      </section>

      <section>
        <h2>6. Perkongsian Maklumat</h2>
        <p>
          Maklumat yang diproses oleh e-OPR tidak dijual kepada pihak ketiga. Maklumat hanya
          diproses melalui perkhidmatan yang diperlukan untuk operasi sistem, termasuk Google
          Drive bagi tujuan penyimpanan fail.
        </p>
      </section>

      <section>
        <h2>7. Tempoh Penyimpanan</h2>
        <p>
          Fail dan rekod e-OPR boleh disimpan selama diperlukan bagi tujuan pengurusan dan rekod
          sekolah, tertakluk kepada pengurusan oleh pentadbir sistem.
        </p>
      </section>

      <section>
        <h2>8. Hak dan Pertanyaan</h2>
        <p>
          Sebarang pertanyaan mengenai privasi atau penggunaan data dalam e-OPR boleh dikemukakan
          kepada pihak pentadbir e-OPR atau pihak pentadbiran SABK Maahad Al-Khair Lil Banat.
        </p>
      </section>

      <section>
        <h2>9. Perubahan Dasar Privasi</h2>
        <p>
          Dasar Privasi ini boleh dikemas kini dari semasa ke semasa apabila terdapat perubahan
          kepada fungsi sistem atau keperluan berkaitan.
        </p>
      </section>

      <section>
        <h2>10. Tarikh Kemas Kini</h2>
        <p>Kemas kini terakhir: 31 Ogos 2026</p>
      </section>
    </div>
  );
}
