const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();

// Log every request so you can see whether Dynamics actually loads the widget.
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} referer=${req.get('referer') || '-'}`);
  next();
});

// No X-Frame-Options / frame-ancestors restrictions: the page must be framable by Dynamics.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`CIF test widget on http://localhost:${PORT}`);
});
