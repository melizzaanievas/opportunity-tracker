import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'dist', 'public');

app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend running on http://0.0.0.0:${port}`);
});
