const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.post('/submit', upload.fields([
  { name: 'to' },
  { name: 'logo' },
  { name: 'pdf' }
]), async (req, res) => {
  try {
    const fromEmail = req.body.email.trim().toLowerCase();
    console.log('📩 Email from form:', fromEmail);
    const { data: allRows } = await supabase
  .from('users_watermark')
  .select('*');

console.log('🧾 All rows in users_watermark:', allRows);

    const text = req.body.text;
    const content = req.body.content;
    const subjectBase = req.body.subjectBase;

    if (!req.body.disclaimer_ack) {
      return res.status(400).send('❌ You must acknowledge the data disclaimer.');
    }

    const allowedList = process.env.ALLOWED_SENDERS
      ? process.env.ALLOWED_SENDERS.split(',').map(e => e.trim().toLowerCase())
      : [];
    console.log(' Allowed senders:', allowedList);
    if (!allowedList.includes(fromEmail.toLowerCase())) {
      console.log('❌ Rejected email (not allowed):', fromEmail);
      return res.status(403).send('❌ Unauthorized: This email is not allowed to send.');
    }
    console.log('✅ Email is allowed, checking Supabase for app password...');

    await supabase
      .from('users_watermark')
      .update({ disclaimer_acknowledged: true })
      .eq('from_email', fromEmail);

    const csvFile = req.files['to'][0];
    const logoFile = req.files['logo'][0];
    const pdfFiles = req.files['pdf'];

    const totalSize = pdfFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      return res.status(400).send('❌ Total uploaded PDFs exceed 25MB.');
    }

    const { data: creds, error: credErr } = await supabase
      .from('users_watermark')
      .select('app_password')
      .eq('from_email', fromEmail)
      .single();
    console.log('🔍 Supabase query result:', { creds, credErr });


    if (credErr || !creds) {
      return res.status(401).send('❌ Unauthorized: Email not found in database.');
    }

    const appPassword = creds.app_password;
    const csvText = fs.readFileSync(csvFile.path, 'utf8');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const logoBuffer = fs.readFileSync(logoFile.path);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: fromEmail,
        pass: appPassword
      }
    });

    for (const row of parsed.data) {
      const to = row['email address'];
      const cc = row['cc'] || '';
      const lenderName = row['lender name'] || 'Lender';

      if (!to) continue;

      const attachments = [];

      for (const pdfFile of pdfFiles) {
        const pdfBuffer = fs.readFileSync(pdfFile.path);
        const watermarkedPdf = await addWatermark(pdfBuffer, logoBuffer, text, lenderName);
        const tempPath = path.join(__dirname, '../uploads', `${Date.now()}_${lenderName}_${pdfFile.originalname}`);
        fs.writeFileSync(tempPath, watermarkedPdf);
        attachments.push({
          filename: `Watermarked_${lenderName}_${pdfFile.originalname}`,
          path: tempPath
        });
      }

      const mailOptions = {
        from: fromEmail,
        to,
        cc: [
    ...cc.split(',').map(c => c.trim()).filter(Boolean),
    fromEmail
  ],
        subject: `${subjectBase} - ${lenderName}`,
        text: content,
        attachments
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Sent to ${to}`);
      attachments.forEach(a => fs.unlinkSync(a.path));
    }

    res.redirect('/thankyou.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error processing request.');
  } finally {
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.existsSync(file.path) && fs.unlinkSync(file.path);
      });
    }
  }
});

async function addWatermark(pdfBuffer, logoBuffer, text, lenderName) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const logoImage = await pdfDoc.embedPng(logoBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoDims = logoImage.scale(0.3);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();

    page.drawImage(logoImage, {
      x: (width - logoDims.width) / 2,
      y: (height - logoDims.height) / 2,
      width: logoDims.width,
      height: logoDims.height,
      opacity: 0.3
    });

    const repeatedText = `${text} - ${lenderName}`;
    const spacing = 150;
    for (let x = -width; x < width * 2; x += spacing) {
      for (let y = -height; y < height * 2; y += spacing) {
        page.drawText(repeatedText, {
          x,
          y,
          size: 18,
          font,
          color: rgb(0.8, 0.8, 0.8),
          rotate: { type: 'degrees', angle: 45 },
          opacity: 0.3
        });
      }
    }

    const brand = 'Powered by pathway catalyst';
    const textWidth = font.widthOfTextAtSize(brand, 10);
    page.drawText(brand, {
      x: width - textWidth - 50,
      y: 30,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.5
    });
  }

  return await pdfDoc.save();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
