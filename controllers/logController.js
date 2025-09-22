const { companyLogger } = require('../services/companyLogger');
const { logCompanyOperation } = require('../middleware/logging');
const { ACTIONS, RESOURCES } = require('../services/companyLogger');

const logController = {
    /**
     * Get logs for a company
     */
    async getCompanyLogs(req, res) {
        try {
            const { companyId } = req.params;
            const { month, isError, level, action, limit = 100, offset = 0 } = req.query;
            
            // Verify user has access to this company
            const authUserId = req.user.userId || req.user.id;
            
            // Get company info to verify access
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUserId)
                .single();

            if (userError || !userData) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .eq('user_id', userData.id)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found or access denied'
                });
            }

            // Get logs
            const logs = await companyLogger.getLogs(companyId, month, isError === 'true');
            
            if (!logs) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve logs'
                });
            }

            // Filter logs based on query parameters
            let filteredLogs = logs;

            if (level) {
                filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
            }

            if (action) {
                filteredLogs = filteredLogs.filter(log => log.action === action);
            }

            // Apply pagination
            const paginatedLogs = filteredLogs.slice(offset, offset + parseInt(limit));

            // Log the log retrieval
            await logCompanyOperation(
                req,
                ACTIONS.API_CALL,
                RESOURCES.SYSTEM,
                companyId,
                `Company logs retrieved for "${company.name}"`,
                {
                    companyId: companyId,
                    companyName: company.name,
                    filters: { month, isError, level, action },
                    pagination: { limit, offset },
                    totalLogs: logs.length,
                    returnedLogs: paginatedLogs.length
                },
                'INFO'
            );

            res.json({
                success: true,
                data: {
                    logs: paginatedLogs,
                    total: filteredLogs.length,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: (offset + parseInt(limit)) < filteredLogs.length
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get company logs error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while retrieving logs'
            });
        }
    },

    /**
     * Get log statistics for a company
     */
    async getLogStats(req, res) {
        try {
            const { companyId } = req.params;
            const { month } = req.query;
            
            // Verify user has access to this company
            const authUserId = req.user.userId || req.user.id;
            
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUserId)
                .single();

            if (userError || !userData) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .eq('user_id', userData.id)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found or access denied'
                });
            }

            // Get logs for statistics
            const logs = await companyLogger.getLogs(companyId, month, false);
            
            if (!logs) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve logs'
                });
            }

            // Calculate statistics
            const stats = {
                total: logs.length,
                byLevel: {},
                byAction: {},
                byResource: {},
                byDay: {},
                errorRate: 0,
                averageResponseTime: 0
            };

            let totalResponseTime = 0;
            let responseTimeCount = 0;

            logs.forEach(log => {
                // Count by level
                stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
                
                // Count by action
                stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
                
                // Count by resource
                stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
                
                // Count by day
                const day = log.timestamp.split('T')[0];
                stats.byDay[day] = (stats.byDay[day] || 0) + 1;
                
                // Calculate response time if available
                if (log.details && log.details.duration) {
                    const duration = parseFloat(log.details.duration.replace('ms', ''));
                    if (!isNaN(duration)) {
                        totalResponseTime += duration;
                        responseTimeCount++;
                    }
                }
            });

            // Calculate error rate
            const errorCount = stats.byLevel.ERROR || 0;
            stats.errorRate = stats.total > 0 ? (errorCount / stats.total) * 100 : 0;

            // Calculate average response time
            stats.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

            res.json({
                success: true,
                data: {
                    companyId: companyId,
                    companyName: company.name,
                    period: month || 'current',
                    statistics: stats
                }
            });

        } catch (error) {
            console.error('❌ Get log stats error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while retrieving log statistics'
            });
        }
    },

    /**
     * Get available log months for a company
     */
    async getAvailableMonths(req, res) {
        try {
            const { companyId } = req.params;
            
            // Verify user has access to this company
            const authUserId = req.user.userId || req.user.id;
            
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUserId)
                .single();

            if (userError || !userData) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .eq('user_id', userData.id)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found or access denied'
                });
            }

            // List files in company folder to get available months
            const { data: files, error: listError } = await supabase.storage
                .from('company-logs')
                .list(`company-${companyId}`);

            if (listError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to list log files'
                });
            }

            // Extract months from file names
            const months = new Set();
            files.forEach(file => {
                const match = file.name.match(/logs-(\d{4}-\d{2})\.log/);
                if (match) {
                    months.add(match[1]);
                }
            });

            const sortedMonths = Array.from(months).sort().reverse();

            res.json({
                success: true,
                data: {
                    companyId: companyId,
                    companyName: company.name,
                    availableMonths: sortedMonths
                }
            });

        } catch (error) {
            console.error('❌ Get available months error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while retrieving available months'
            });
        }
    }
};

module.exports = logController;
