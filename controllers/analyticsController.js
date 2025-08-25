const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get overview analytics
const getOverviewAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let query = supabase.from('interactions').select('*');
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: interactions, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Calculate metrics
    const totalViews = interactions.filter(i => i.action === 'view').length;
    const totalQuestions = interactions.filter(i => i.action === 'question').length;
    const totalMeetings = interactions.filter(i => i.action === 'meeting_booked').length;
    const avgEngagement = interactions.length > 0 
      ? interactions.reduce((sum, i) => sum + (i.engagement_score || 0), 0) / interactions.length 
      : 0;

    const overview = {
      totalDemoViews: totalViews,
      questionsAsked: totalQuestions,
      meetingsBooked: totalMeetings,
      avgEngagement: Math.round(avgEngagement * 100) / 100
    };

    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get conversion funnel
const getConversionFunnel = async (req, res) => {
  try {
    const { qudemoId, dateFrom, dateTo } = req.query;
    
    let query = supabase.from('interactions').select('*');
    
    if (qudemoId) {
      query = query.eq('qudemo_id', qudemoId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: interactions, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const total = interactions.length;
    const completed = interactions.filter(i => i.engagement_score >= 80).length;
    const questions = interactions.filter(i => i.action === 'question').length;
    const meetings = interactions.filter(i => i.action === 'meeting_booked').length;

    const funnel = [
      { label: 'Completed (>80%)', value: completed, total },
      { label: 'Questions Asked', value: questions, total },
      { label: 'Meeting Booked', value: meetings, total }
    ];

    res.json({ success: true, data: funnel });
  } catch (error) {
    console.error('Error fetching conversion funnel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get recent activity
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data, error } = await supabase
      .from('interactions')
      .select(`
        *,
        qudemos(title)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const activity = data.map(interaction => ({
      name: interaction.buyer_name,
      time: getTimeAgo(interaction.created_at),
      demo: interaction.qudemos?.title || 'Unknown Demo',
      questions: interaction.questions_asked || 0,
      action: interaction.action,
      initial: interaction.buyer_name?.charAt(0) || 'U'
    }));

    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get weekly activity chart data
const getWeeklyActivity = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let query = supabase.from('interactions').select('*');
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: interactions, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Group by day and calculate metrics
    const dailyStats = {};
    
    interactions.forEach(interaction => {
      const date = new Date(interaction.created_at).toLocaleDateString();
      if (!dailyStats[date]) {
        dailyStats[date] = { Views: 0, Questions: 0, Meetings: 0 };
      }
      
      if (interaction.action === 'view') dailyStats[date].Views++;
      if (interaction.action === 'question') dailyStats[date].Questions++;
      if (interaction.action === 'meeting_booked') dailyStats[date].Meetings++;
    });

    // Convert to array format for chart
    const weeklyData = Object.entries(dailyStats).map(([date, stats]) => ({
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      ...stats
    }));

    res.json({ success: true, data: weeklyData });
  } catch (error) {
    console.error('Error fetching weekly activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get demo performance metrics
const getDemoPerformance = async (req, res) => {
  try {
    const { data: qudemos, error: qudemosError } = await supabase
      .from('qudemos')
      .select('id, title');

    if (qudemosError) {
      return res.status(400).json({ error: qudemosError.message });
    }

    const performanceData = [];

    for (const qudemo of qudemos) {
      const { data: interactions, error: interactionsError } = await supabase
        .from('interactions')
        .select('*')
        .eq('qudemo_id', qudemo.id);

      if (interactionsError) continue;

      const views = interactions.filter(i => i.action === 'view').length;
      const questions = interactions.filter(i => i.action === 'question').length;
      const meetings = interactions.filter(i => i.action === 'meeting_booked').length;
      const completionRate = views > 0 ? Math.round((interactions.filter(i => i.engagement_score >= 80).length / views) * 100) : 0;
      const conversionRate = views > 0 ? Math.round((meetings / views) * 100) : 0;

      performanceData.push({
        demo: qudemo.title,
        views,
        completion: `${completionRate}%`,
        questions,
        conversion: `${conversionRate}%`
      });
    }

    res.json({ success: true, data: performanceData });
  } catch (error) {
    console.error('Error fetching demo performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get engagement analytics
const getEngagementAnalytics = async (req, res) => {
  try {
    const { qudemoId, buyerEmail, minEngagementScore, maxEngagementScore } = req.query;
    
    let query = supabase.from('interactions').select('*');
    
    if (qudemoId) {
      query = query.eq('qudemo_id', qudemoId);
    }
    if (buyerEmail) {
      query = query.eq('buyer_email', buyerEmail);
    }
    if (minEngagementScore) {
      query = query.gte('engagement_score', minEngagementScore);
    }
    if (maxEngagementScore) {
      query = query.lte('engagement_score', maxEngagementScore);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const engagementStats = {
      total: data.length,
      average: data.length > 0 ? data.reduce((sum, i) => sum + (i.engagement_score || 0), 0) / data.length : 0,
      highEngagement: data.filter(i => (i.engagement_score || 0) >= 80).length,
      mediumEngagement: data.filter(i => (i.engagement_score || 0) >= 50 && (i.engagement_score || 0) < 80).length,
      lowEngagement: data.filter(i => (i.engagement_score || 0) < 50).length
    };

    res.json({ success: true, data: engagementStats });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get time ago
const getTimeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
  return `${Math.floor(diffInMinutes / 1440)} days ago`;
};

module.exports = {
  getOverviewAnalytics,
  getConversionFunnel,
  getRecentActivity,
  getWeeklyActivity,
  getDemoPerformance,
  getEngagementAnalytics
}; 