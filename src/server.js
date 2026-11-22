const app = require('./app');
const db = require('./db');

const port = process.env.PORT || 3000;

db.initDb()
  .then(() => app.listen(port, () => console.log(`StayFinder API listening on port ${port}`)))
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
