const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const asyncQueue = require('../config/asyncQueue');
const { v4: uuidv4 } = require('uuid');

// Create new interaction - Now using queue for heavy operations
const createInteraction = async (req, res) => {
  try {
    const interactionData = {
      id: uuidv4(),
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('interactions')
      .insert(interactionData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error creating interaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all interactions with filters
const getInteractions = async (req, res) => {
  try {
    const { 
      buyerEmail, 
      qudemoId, 
      status, 
      dateFrom, 
      dateTo, 
      sortBy, 
      sortOrder, 
      page, 
      limit 
    } = req.query;
    
    let query = supabase
      .from('interactions')
      .select('*');

    // Apply filters
    if (buyerEmail) {
      query = query.eq('buyer_email', buyerEmail);
    }
    
    if (qudemoId) {
      query = query.eq('qudemo_id', qudemoId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply sorting
    const orderBy = sortBy || 'created_at';
    const order = sortOrder || 'desc';
    query = query.order(orderBy, { ascending: order === 'asc' });

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      success: true, 
      data, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || data.length,
        pages: Math.ceil((count || data.length) / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get interaction by ID
const getInteractionById = async (req, res) => {
  try {
    const { interactionId } = req.params;

    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('id', interactionId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching interaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update interaction
const updateInteraction = async (req, res) => {
  try {
    const { interactionId } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('interactions')
      .update(updateData)
      .eq('id', interactionId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating interaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add question to interaction - Now using queue for AI processing
const addQuestion = async (req, res) => {
    try {
        const { interactionId } = req.params;
        const { question, answer, companyName } = req.body;

        if (answer) {
            // If answer is provided, save directly
            const questionData = {
                id: uuidv4(),
                interaction_id: interactionId,
                question,
                answer,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('questions')
                .insert(questionData)
                .select()
                .single();

            if (error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(201).json({ success: true, data });
        }

        if (companyName) {
            // If no answer and companyName, queue for AI processing
            const jobData = {
                interactionId,
                question,
                companyName,
                userId: req.user?.userId || req.user?.id,
                timestamp: new Date().toISOString()
            };

            const jobId = await asyncQueue.addQAJob(jobData, parseInt(process.env.QUEUE_QA_PRIORITY) || 1);
            
            const queueStatus = asyncQueue.getQueueStatus();
            const waitingJobs = queueStatus.qa.waiting;

            return res.status(202).json({
                success: true,
                message: 'Question queued for AI processing',
                data: {
                    jobId: jobId,
                    queuePosition: waitingJobs,
                    estimatedWaitTime: `${Math.ceil(waitingJobs / 5) * 10}-${Math.ceil(waitingJobs / 5) * 30} seconds`,
                    status: 'queued'
                }
            });
        }

        // Fallback: save question without answer
        const questionData = {
            id: uuidv4(),
            interaction_id: interactionId,
            question,
            answer: null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('questions')
            .insert(questionData)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('❌ Add question error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get questions for interaction
const getInteractionQuestions = async (req, res) => {
  try {
    const { interactionId } = req.params;

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('interaction_id', interactionId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending follow-ups
const getPendingFollowUps = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching pending follow-ups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get high engagement interactions
const getHighEngagementInteractions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .gte('engagement_score', 70)
      .order('engagement_score', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching high engagement interactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get interaction summary
const getInteractionSummary = async (req, res) => {
  try {
    const { qudemoId } = req.params;

    // Get total interactions
    const { data: totalInteractions, error: totalError } = await supabase
      .from('interactions')
      .select('id', { count: 'exact' })
      .eq('qudemo_id', qudemoId);

    // Get interactions by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('interactions')
      .select('status')
      .eq('qudemo_id', qudemoId);

    if (totalError || statusError) {
      return res.status(400).json({ error: 'Error fetching summary' });
    }

    const statusSummary = statusCounts.reduce((acc, interaction) => {
      acc[interaction.status] = (acc[interaction.status] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      total: totalInteractions?.length || 0,
      byStatus: statusSummary,
      averageEngagement: 0 // TODO: Calculate average engagement
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching interaction summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createInteraction,
  getInteractions,
  getInteractionById,
  updateInteraction,
  addQuestion,
  getInteractionQuestions,
  getPendingFollowUps,
  getHighEngagementInteractions,
  getInteractionSummary
}; 