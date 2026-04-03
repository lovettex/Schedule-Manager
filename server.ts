import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { google } from 'googleapis';
import { Client } from '@notionhq/client';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'construction-manager-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
  }
}));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
);

// API Routes
app.get('/api/auth/google/url', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ url });
});

app.get('/api/auth/notion/url', (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/notion/callback`;
  
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.json({ url });
});

app.get('/auth/notion/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/notion/callback`;

  try {
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    (req.session as any).notionToken = data.access_token;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'NOTION_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for Notion token:', error);
    res.status(500).send('Authentication failed');
  }
});

app.post('/api/notion/sync', async (req, res) => {
  const token = (req.session as any).notionToken;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated with Notion' });
  }

  const { tasks, projectName } = req.body;
  const notion = new Client({ auth: token });

  try {
    // 1. Find or create a database
    // For simplicity, we'll look for a database named after the project or "Project Management"
    const searchResponse = await notion.search({
      filter: { property: 'object', value: 'database' } as any,
      query: projectName || 'Project Management',
    });

    let databaseId = (searchResponse.results[0] as any)?.id;

    if (!databaseId) {
      // If no database found, we need a parent page to create one.
      // We'll try to find any page to use as parent.
      const pageSearch = await notion.search({
        filter: { property: 'object', value: 'page' } as any,
        page_size: 1,
      });

      if (pageSearch.results.length === 0) {
        return res.status(400).json({ error: 'No Notion pages found to create a database in. Please share a page with the integration.' });
      }

      const parentPageId = (pageSearch.results[0] as any).id;
      const newDatabase = await notion.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: projectName || 'Project Management' } }],
        properties: {
          Name: { title: {} },
          Date: { date: {} },
          Status: { select: { options: [
            { name: 'Pending', color: 'orange' },
            { name: 'In Progress', color: 'blue' },
            { name: 'Completed', color: 'green' }
          ] } },
          Description: { rich_text: {} }
        }
      } as any);
      databaseId = newDatabase.id;
    }

    // 2. Sync tasks
    for (const task of tasks) {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: task.title } }] },
          Date: { date: { 
            start: task.startDate,
            end: task.endDate !== task.startDate ? task.endDate : null
          } },
          Status: { select: { name: task.status === 'in-progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1) } },
          Description: { rich_text: [{ text: { content: task.description || '' } }] }
        }
      });
    }

    res.json({ success: true, databaseUrl: `https://www.notion.so/${databaseId.replace(/-/g, '')}` });
  } catch (error) {
    console.error('Error syncing to Notion:', error);
    res.status(500).json({ error: 'Failed to sync to Notion' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    (req.session as any).tokens = tokens;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

app.post('/api/calendar/sync', async (req, res) => {
  const tokens = (req.session as any).tokens;
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Invalid tasks data' });
  }

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const results = [];
    for (const task of tasks) {
      const event = {
        summary: task.title,
        description: task.description || '',
        start: {
          dateTime: task.startDate, // Assuming ISO string from client
          timeZone: 'UTC',
        },
        end: {
          dateTime: task.endDate, // Assuming ISO string from client
          timeZone: 'UTC',
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      results.push(response.data);
    }

    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
    res.status(500).json({ error: 'Failed to sync to Google Calendar' });
  }
});

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
