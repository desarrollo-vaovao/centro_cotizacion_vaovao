process.env.TZ = process.env.TZ || 'America/Guatemala';

import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const app = createApp();
app.listen(PORT, () => console.log(`Backend escuchando en puerto ${PORT}`));
