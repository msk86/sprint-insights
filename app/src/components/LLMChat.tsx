import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { SprintData, ChartConfiguration, TableConfiguration } from '../types';
import { llmApi } from '../services/api';
import { formatTime } from '../utils/dateFormat';
import { calculateSprintStats, calculateDoraMetrics } from '../services/stats';
import { calculateBuildSummaryByPipeline } from '../utils/buildStats';
import { calculateIssueTimeSpentOnColumns } from '../services/issue';
import DynamicChart from './DynamicChart';
import DynamicTable from './DynamicTable';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chart?: ChartConfiguration;
  table?: TableConfiguration;
}

interface LLMChatProps {
  sprintData: SprintData;
  historicalData?: SprintData[];
  historicalStats?: any[];
}

const LLMChat: React.FC<LLMChatProps> = ({ sprintData, historicalData, historicalStats }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      // Calculate stats for LLM context
      const sprintStats = calculateSprintStats(sprintData);
      const doraMetrics = calculateDoraMetrics(sprintData);
      
      // Calculate build/release summary per pipeline
      const buildSummaryByPipeline = calculateBuildSummaryByPipeline(sprintData.builds);
      
      const stats = {
        totalIssues: sprintData.issues.length,
        totalPoints: sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0),
        completedIssues: sprintStats.throughput,
        completedPoints: sprintStats.velocity,
        backAndForthIssues: sprintData.issues.filter(issue => issue.flags?.isBackAndForth).length,
        incidentIssues: sprintData.issues.filter(issue => issue.flags?.isIncidentResponse).length,
        totalBuilds: sprintData.builds.length,
        totalReleases: sprintData.builds.filter(b => b.isRelease).length,
        successfulBuilds: sprintData.builds.filter(b => b.status === 'passed').length,
        successfulReleases: sprintData.builds.filter(b => b.isRelease && b.status === 'passed').length,
        avgBuildDuration: sprintData.builds.length > 0 
          ? sprintData.builds.reduce((sum, b) => sum + b.duration, 0) / sprintData.builds.length / 60
          : 0,
        deploymentFrequency: doraMetrics.deploymentFrequency,
        medianLeadTime: doraMetrics.avgLeadTime,
        changeFailureRate: doraMetrics.changeFailureRate,
        medianMTTR: doraMetrics.mttr,
        buildSummaryByPipeline,
      };

      // Enrich issues with timeSpent and filter out boundary events for LLM
      const enrichIssuesWithTimeSpent = (data: SprintData) => {
        const enrichedIssues = data.issues.map(issue => ({
          ...issue,
          timeSpent: calculateIssueTimeSpentOnColumns(issue, data),
          // Filter out boundary events (inSprint: false) from history
          history: issue.history.filter(h => h.inSprint)
        }));
        return { ...data, issues: enrichedIssues, builds: [] };
      };

      // Prepare sprint data without builds for LLM
      const sprintDataForLLM = enrichIssuesWithTimeSpent(sprintData);
      const historicalDataForLLM = historicalData?.map(sprint => enrichIssuesWithTimeSpent(sprint));

      // Prepare chat history (exclude the current message that was just added)
      const chatHistory = messages.map(msg => {
        // For chart/table responses without analysis, use a descriptive message
        let content = msg.content;
        if (!content && msg.type === 'assistant') {
          if (msg.chart) {
            content = `Generated chart: ${msg.chart.title}`;
          } else if (msg.table) {
            content = `Generated table: ${msg.table.title}`;
          }
        }
        
        return {
          role: msg.type,
          content: content || 'No content'
        };
      });

      const response = await llmApi.freeChat(
        sprintDataForLLM, 
        inputMessage, 
        stats, 
        chatHistory,
        historicalDataForLLM,
        historicalStats
      );
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        // Ignore analysis if chart or table is present
        content: (response.chart || response.table) ? '' : (response.analysis || 'No response provided'),
        timestamp: new Date(),
        chart: response.chart,
        table: response.table,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to get response from AI');
      console.error('Error in LLM chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
        Ask questions about the sprint data and get AI-powered insights.
      </Typography>

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <List>
            {messages.map((message) => (
              <ListItem key={message.id} sx={{ flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                {message.content && (
                  <Box
                    sx={{
                      bgcolor: message.type === 'user' ? 'primary.main' : 'grey.100',
                      color: message.type === 'user' ? 'white' : 'text.primary',
                      p: 1.5,
                      borderRadius: 2,
                      maxWidth: '80%',
                      alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                      {formatTime(message.timestamp)}
                    </Typography>
                  </Box>
                )}
                {message.chart && message.type === 'assistant' && (
                  <Box sx={{ width: '100%', mt: message.content ? 1 : 0 }}>
                    <DynamicChart
                      chartConfig={message.chart}
                      sprintData={sprintData}
                      historicalData={historicalData}
                    />
                  </Box>
                )}
                {message.table && message.type === 'assistant' && (
                  <Box sx={{ width: '100%', mt: message.content ? 1 : 0 }}>
                    <DynamicTable
                      tableConfig={message.table}
                      sprintData={sprintData}
                      historicalData={historicalData}
                    />
                  </Box>
                )}
              </ListItem>
            ))}
            {loading && (
              <ListItem>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    AI is thinking...
                  </Typography>
                </Box>
              </ListItem>
            )}
          </List>
          <div ref={messagesEndRef} />
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder="Ask about the sprint data..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
              startIcon={<SendIcon />}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LLMChat;
