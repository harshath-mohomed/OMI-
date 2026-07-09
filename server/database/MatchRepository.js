export class MatchRepository {
  /** @param {import('pg').Pool} dbPool */
  constructor(dbPool) {
    this.pool = dbPool;
  }

  async saveMatchResult({ roomCode, winnerTeam, scoreA, scoreB }) {
    const id = Math.random().toString(36).substring(2, 11);
    const insertQuery = `
      INSERT INTO matches (id, room_code, winner_team, score_a, score_b, played_at) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;
    
    const result = await this.pool.query(insertQuery, [
      id, roomCode, winnerTeam, scoreA, scoreB, new Date().toISOString()
    ]);

    // Update cumulative lifetime statistics for metrics aggregation blocks
    const winTeamLabel = winnerTeam; // 'A' or 'B'
    const matchPlayersQuery = `SELECT id, seat FROM players;`; // Real production implementations join via active room state models
    
    return result.rows[0];
  }
}