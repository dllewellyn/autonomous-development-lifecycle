import { Probot } from 'probot';
import { setupServer } from './server';

/**
 * Main Probot application entry point
 * This function is called by Probot to set up the app
 */
export default (app: Probot) => {
  console.log('Starting ADL Monolith service...');
  console.log('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    stateBucket: process.env.STATE_BUCKET ? '✓' : '✗',
    julesApiKey: process.env.JULES_API_KEY ? '✓' : '✗',
    geminiApiKey: process.env.GEMINI_API_KEY ? '✓' : '✗',
    githubRepository: process.env.GITHUB_REPOSITORY || 'not set',
  });

  setupServer(app);

  console.log('ADL Monolith service started successfully');
};
