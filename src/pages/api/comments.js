// src/pages/api/comments.js
import { neon } from '@neondatabase/serverless';

export async function all({ request }) {
  return handleRequest(request);
}

export async function get({ request }) {
  return handleRequest(request);
}

export async function post({ request }) {
  return handleRequest(request);
}

export async function patch({ request }) {
  return handleRequest(request);
}

export async function options() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const sql = neon(import.meta.env.POSTGRES_URL || process.env.POSTGRES_URL);

    // Handle GET: Fetch comments for a specific article ID
    if (method === 'GET') {
      const article_id = url.searchParams.get('article_id');
      const targetArticle = article_id || 'default-article';

      const comments = await sql`
        SELECT id, article_id as "articleId", author, email, content, parent_id as "parentId", likes, dislikes, created_at as "date"
        FROM comments
        WHERE article_id = ${targetArticle}
        ORDER BY created_at ASC;
      `;
      return new Response(JSON.stringify(comments), { status: 200, headers });
    }

    // Parse body for POST / PATCH requests
    let body = {};
    try {
      body = await request.json();
    } catch (e) {}

    // Handle POST: Add new comment or reply
    if (method === 'POST') {
      const { author, email, content, parent_id, article_id, targetArticleId } = body;
      const finalArticleId = targetArticleId || article_id || 'default-article';

      if (!content || !author) {
        return new Response(JSON.stringify({ error: 'Author and content are required.' }), { status: 400, headers });
      }

      const newComment = await sql`
        INSERT INTO comments (article_id, author, email, content, parent_id, likes, dislikes)
        VALUES (${finalArticleId}, ${author.trim()}, ${email ? email.trim() : ''}, ${content.trim()}, ${parent_id || null}, 0, 0)
        RETURNING id, article_id as "articleId", author, email, content, parent_id as "parentId", likes, dislikes, created_at as "date";
      `;
      return new Response(JSON.stringify(newComment[0]), { status: 201, headers });
    }

    // Handle PATCH/Vote: Increment likes or dislikes securely
    if (method === 'PATCH') {
      const { id, action } = body;

      if (!id || !action) {
        return new Response(JSON.stringify({ error: 'ID and action are required.' }), { status: 400, headers });
      }

      let updated;
      if (action === 'like') {
        updated = await sql`
          UPDATE comments
          SET likes = likes + 1
          WHERE id = ${id}
          RETURNING id, article_id as "articleId", author, email, content, parent_id as "parentId", likes, dislikes, created_at as "date";
        `;
      } else if (action === 'dislike') {
        updated = await sql`
          UPDATE comments
          SET dislikes = dislikes + 1
          WHERE id = ${id}
          RETURNING id, article_id as "articleId", author, email, content, parent_id as "parentId", likes, dislikes, created_at as "date";
        `;
      } else {
        return new Response(JSON.stringify({ error: 'Invalid action type.' }), { status: 400, headers });
      }

      if (!updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Comment not found.' }), { status: 404, headers });
      }

      return new Response(JSON.stringify(updated[0]), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error) {
    console.error('Database Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error: ' + error.message }), { status: 500, headers });
  }
}