# Account deletion request workflow draft

**Status: Account-foundation workflow. The in-app path is implemented, but this document remains a draft until the owner completes the placeholders, tests the path on Preview, and approves the privacy terms.**

## Recommended contact channel

The primary deletion channel is the authenticated in-app flow at `/account`. The user chooses **Delete account**, reads the second confirmation, and confirms. The app invokes the server-only `delete-account` Supabase Edge Function; the function validates the access token, deletes user-owned data through `delete_my_account_data()`, calls `auth.admin.deleteUser`, and returns a result the app can display. Do not expose the service-role key to Vercel client variables or the browser.

Keep a monitored privacy contact such as `privasi@[your-domain]` or `privacy@[your-domain]` for questions and cases where the in-app flow fails. Publish it only after the owner has tested delivery and account security.

Do not ask users to send passwords, access tokens, payment details, or identity documents by email. Do not use a personal inbox that is shared with unrelated services. If the project has no domain, create a separate project mailbox before publishing this draft.

## Public notice draft

### Indonesian

Untuk menghapus akun Skor Lapangan, buka **Akun**, pilih **Hapus akun**, baca konfirmasi kedua, lalu konfirmasi. Proses ini menghapus data akun yang tercantum pada halaman dan mengeluarkan Anda dari sesi. Jangan kirim kata sandi, token akses, atau kode masuk melalui email. Untuk masalah penghapusan, hubungi `[PRIVACY CONTACT EMAIL]`. Target tanggapan dukungan: `[OWNER TO SET A REALISTIC RESPONSE TARGET]`.

### English

To delete your Skor Lapangan account, open **Account**, choose **Delete account**, read the second confirmation, and confirm. The flow removes the account data listed on the page and signs you out. Do not send passwords, access tokens, or sign-in codes by email. For a failed deletion, contact `[PRIVACY CONTACT EMAIL]`. Support response target: `[OWNER TO SET A REALISTIC RESPONSE TARGET]`.

## Request email template

**Subject:** Account deletion request

Hello Skor Lapangan,

The in-app deletion flow was unavailable or failed. Please help me delete my Skor Lapangan account and the personal data associated with it.

- Google account email: `[EMAIL USED TO SIGN IN]`
- Optional detail to help locate the account: `[OPTIONAL]`

I understand that deleting the account may remove saved match history and may affect Community Rules I created, if that feature is enabled.

Thank you.

## Receipt confirmation draft

Halo,

Kami menerima permintaan penghapusan akun Skor Lapangan pada `[DATE RECEIVED]`. Kami akan memverifikasi bahwa permintaan berasal dari pemilik akun sebelum memprosesnya. Kami menargetkan pembaruan berikutnya dalam `[RESPONSE TARGET]`.

Jangan kirim kata sandi atau kode masuk. Jika email ini bukan permintaan Anda, balas untuk memberi tahu kami.

Terima kasih,
Skor Lapangan

## Verification response draft

Halo,

Kami belum dapat mencocokkan permintaan ini dengan akun Skor Lapangan. Untuk melindungi akun, kirim permintaan baru dari alamat Google yang digunakan untuk masuk. Jangan kirim kata sandi, kode masuk, atau dokumen identitas.

Terima kasih,
Skor Lapangan

## Completion response draft

Halo,

Kami telah menyelesaikan permintaan penghapusan akun Skor Lapangan pada `[DATE COMPLETED]`. Data yang dihapus: `[LIST VERIFIED DATA CATEGORIES]`. Data yang masih disimpan, jika ada: `[CATEGORY, REASON, AND RETENTION PERIOD]`.

Jika Anda masih memiliki salinan lokal di browser, hapus data situs Skor Lapangan dari pengaturan browser.

Terima kasih,
Skor Lapangan

## Operator checklist

- Treat the authenticated in-app request as the normal verification path. For fallback support, confirm the request came from the Google address linked to the account. Never request the user's password, access token, or one-time sign-in code.
- Record the request date, verification result, completion date, and action taken in a restricted log. Do not copy unnecessary personal details into the log.
- Confirm the implemented deletion scope: owned matches and cascading events, user-created Community Rules and versions if present, reports created by the user, viewer capabilities stored on those matches, local browser matches, and the Supabase Auth user. Document any provider backups or logs that cannot be removed immediately.
- Test account deletion and its database cascades in a disposable Supabase project. Do not test against production data.
- Delete the user through an authorized Supabase administrative path. Never expose a service-role key in the browser or ask the user to send credentials.
- Confirm the account can no longer sign in and the intended records are gone or retained according to the approved policy.
- For fallback requests, send the completion response and update the restricted request log. The normal in-app flow does not require manual operator action.

## Owner decisions required before publication

- Real privacy contact email and the person who monitors it.
- Response target that the operator can meet.
- Operator name, service region, and applicable retention requirements.
- Whether account deletion also deletes or unpublishes Community Rules and what happens to associated reports.
- Backup and provider log retention after account deletion.
- The final wording approved for the privacy notice and terms of use.
