export class StatisticsRepository {
  constructor(dbInstance) {
    this.db = dbInstance;
  }

  async getGlobalStats() {
    const totalMatches = this.db.prepare('SELECT COUNT(*) as count FROM matches').get().count;
    return { totalMatches };
  }
}