# Account deletion request workflow draft

**Status: Draft for V1.1. Google accounts and account history are not available in V1.0. Do not publish this workflow until the owner completes the placeholders, tests the deletion path, and approves the privacy terms.**

## Recommended contact channel

Use a dedicated email alias such as `privasi@[your-domain]` or `privacy@[your-domain]`, forwarded to a mailbox only the operator can access. Email is the simplest channel for a one-person operation and does not require a new in-app form. Publish the address only after it exists and the operator has tested delivery and account security.

Do not ask users to send passwords, access tokens, payment details, or identity documents by email. Do not use a personal inbox that is shared with unrelated services. If the project has no domain, create a separate project mailbox before publishing this draft.

## Public notice draft

### Indonesian

Untuk meminta penghapusan akun Skor Lapangan, kirim email ke `[PRIVACY CONTACT EMAIL]` dari alamat Google yang terhubung ke akun. Tulis `Permintaan penghapusan akun` pada subjek. Jangan kirim kata sandi atau kode masuk. Kami akan memverifikasi permintaan sebelum menghapus akun dan data terkait. Kami akan menjelaskan jika ada data yang harus kami simpan untuk alasan yang sah. Target tanggapan: `[OWNER TO SET A REALISTIC RESPONSE TARGET]`.

### English

To request deletion of your Skor Lapangan account, email `[PRIVACY CONTACT EMAIL]` from the Google address linked to your account. Use `Account deletion request` as the subject. Do not send your password or sign-in codes. We will verify the request before deleting the account and related data. We will explain if we must retain any data for a lawful reason. Response target: `[OWNER TO SET A REALISTIC RESPONSE TARGET]`.

## Request email template

**Subject:** Account deletion request

Hello Skor Lapangan,

Please delete my Skor Lapangan account and the personal data associated with it.

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

- Confirm the request came from the Google address linked to the account. Never request the user's password or one-time sign-in code.
- Record the request date, verification result, completion date, and action taken in a restricted log. Do not copy unnecessary personal details into the log.
- Decide how to handle account match history, user-created Community Rules, reports, and backups before V1.1. Recommended starting point: unpublish and remove rules owned by the account, delete its account match records, and retain no more personal data than the operator can justify and explain in the privacy notice.
- Test account deletion and its database cascades in a disposable Supabase project. Do not test against production data.
- Delete the user through an authorized Supabase administrative path. Never expose a service-role key in the browser or ask the user to send credentials.
- Confirm the account can no longer sign in and the intended records are gone or retained according to the approved policy.
- Send the completion response and update the restricted request log.

## Owner decisions required before publication

- Real privacy contact email and the person who monitors it.
- Response target that the operator can meet.
- Operator name, service region, and applicable retention requirements.
- Whether account deletion also deletes or unpublishes Community Rules and what happens to associated reports.
- Backup and provider log retention after account deletion.
- The final wording approved for the privacy notice and terms of use.
