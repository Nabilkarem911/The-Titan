export async function budgetTracker(params: { action: 'add' | 'summary' | 'forecast'; entries?: Array<{ description: string; amount: number; type: 'income' | 'expense'; category: string; date?: string }>; months?: number }): Promise<string> {
  const { action, entries = [], months = 3 } = params;

  switch (action) {
    case 'add': {
      if (entries.length === 0) throw new Error('entries required');
      const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const totalExpenses = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      return JSON.stringify({ recorded: entries.length, totalIncome, totalExpenses, net: totalIncome - totalExpenses });
    }
    case 'summary': {
      const byCategory: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      for (const e of entries) {
        if (e.type === 'income') totalIncome += e.amount;
        else totalExpenses += e.amount;
        if (e.type === 'expense') byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      }

      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      return JSON.stringify({ totalIncome, totalExpenses, net: totalIncome - totalExpenses, savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0, topCategories: sorted.slice(0, 5).map(([cat, amt]) => ({ category: cat, amount: amt, percentage: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0 })), entryCount: entries.length });
    }
    case 'forecast': {
      const monthlyExpenses = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      const monthlyIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const forecast: Array<{ month: number; projectedIncome: number; projectedExpenses: number; projectedNet: number; cumulativeNet: number }> = [];
      let cumulative = 0;

      for (let m = 1; m <= months; m++) {
        const inc = monthlyIncome * (1 + 0.02 * m); // 2% growth
        const exp = monthlyExpenses * (1 + 0.01 * m); // 1% inflation
        const net = inc - exp;
        cumulative += net;
        forecast.push({ month: m, projectedIncome: Math.round(inc), projectedExpenses: Math.round(exp), projectedNet: Math.round(net), cumulativeNet: Math.round(cumulative) });
      }

      return JSON.stringify({ monthlyIncome, monthlyExpenses, forecast });
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}
