/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.load({path: path.join(process.cwd(), '.env')});

const env = process.env.NODE_ENV || 'development';
const src = env === 'production' ? './build/app.js' : './src/app.js';

if (env === 'development') {
    // for development use babel/register for faster runtime compilation
    require('babel-register');
}

require(src);
