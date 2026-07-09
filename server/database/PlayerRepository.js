/** Data access abstraction layer isolating PostgreSQL storage from core Omi engine. */
export class PlayerRepository {
  /** @param {import('pg').Pool} dbPool PostgreSQL connection pool */
  constructor(dbPool) {
    this.pool = dbPool;
  }

  async findOrCreatePlayer(username) {
    // Attempt retrieval of existing player identity record
    const selectQuery = 'SELECT id, username FROM players WHERE username = $1;';
    const existing = await this.pool.query(selectQuery, [username]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // fallback: Create a new user record safely with parameterization
    const id = Math.random().toString(36).substring(2, 11);
    const insertQuery = 'INSERT INTO players (id, username) VALUES ($1, $2) RETURNING id, username;';
    const result = await this.pool.query(insertQuery, [id, username]);
    
    // Seed the stats tracking snapshot table asynchronously
    await this.pool.query('INSERT INTO player_stats (player_id) VALUES ($1) ON CONFLICT DO NOTHING;', [id]);

    return result.rows[0];
  }
}