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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Send as SendIcon, BarChart as VisualizeIcon } from '@mui/icons-material';
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
  computedData?: any[];  // Store the actual computed data from dataTransform
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear chat history when sprint data changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [sprintData.sprint.index, sprintData.sprint.name]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const containsVisualizationKeywords = (text: string): boolean => {
    const keywords = ['chart', 'graph', 'visualize', 'visualization', 'show me', 'plot', 'distribution', 'table', 'list', 'display'];
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  };

  const prepareCommonData = () => {
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
      // For chart/table responses, include the computed data so LLM can reference it in follow-up questions
      let content = msg.content;
      if (msg.type === 'assistant') {
        if (msg.chart && msg.computedData) {
          // Include chart title and computed data
          const chartInfo = `Generated chart: ${msg.chart.title}\n\nChart Data (${msg.computedData.length} items):\n${JSON.stringify(msg.computedData, null, 2)}`;
          content = content ? `${content}\n\n${chartInfo}` : chartInfo;
        } else if (msg.table && msg.computedData) {
          // Include table title and computed data
          const tableInfo = `Generated table: ${msg.table.title}\n\nTable Data (${msg.computedData.length} rows):\n${JSON.stringify(msg.computedData, null, 2)}`;
          content = content ? `${content}\n\n${tableInfo}` : tableInfo;
        } else if (msg.chart) {
          // Fallback if computedData is not available
          content = content ? content : `Generated chart: ${msg.chart.title}`;
        } else if (msg.table) {
          // Fallback if computedData is not available
          content = content ? content : `Generated table: ${msg.table.title}`;
        }
      }
      
      return {
        role: msg.type,
        content: content || 'No content'
      };
    });

    return { stats, sprintDataForLLM, historicalDataForLLM, chatHistory };
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    // Check if the message contains visualization keywords
    if (containsVisualizationKeywords(inputMessage)) {
      setConfirmDialogOpen(true);
      return;
    }

    // Proceed with asking a question
    await sendAsQuestion();
  };

  const sendAsQuestion = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setConfirmDialogOpen(false);
    setLoading(true);
    setError(null);

    try {
      const { stats, sprintDataForLLM, historicalDataForLLM, chatHistory } = prepareCommonData();

      const response = await llmApi.freeChat(
        sprintDataForLLM, 
        currentInput, 
        stats, 
        chatHistory,
        historicalDataForLLM,
        historicalStats
      );
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.analysis || 'No response provided',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to get response from AI');
      console.error('Error in LLM chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVisualize = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setConfirmDialogOpen(false); // Close dialog if open
    setLoading(true);
    setError(null);

    try {
      const { stats, sprintDataForLLM, historicalDataForLLM, chatHistory } = prepareCommonData();

      const response = await llmApi.visualize(
        sprintDataForLLM, 
        currentInput, 
        stats, 
        chatHistory,
        historicalDataForLLM,
        historicalStats
      );
      
      // Compute the actual data if chart/table was generated
      let computedData: any[] | undefined;
      if (response.chart || response.table) {
        try {
          // Prepare allSprints data (similar to DynamicChart/DynamicTable)
          const allSprints = historicalData ? [...historicalData, sprintData] : [sprintData];
          const dataTransformCode = response.chart?.dataTransform || response.table?.dataTransform || '';
          
          // Execute the dataTransform function
          const dataTransformFunc = new Function('allSprints', `${dataTransformCode}`);
          computedData = dataTransformFunc(allSprints);
        } catch (error) {
          console.error('Error computing data for chat history:', error);
        }
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: (response.chart || response.table) ? '' : (response.analysis || 'No response provided'),
        timestamp: new Date(),
        chart: response.chart,
        table: response.table,
        computedData,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to generate visualization');
      console.error('Error in LLM visualization:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDialog = () => {
    setConfirmDialogOpen(false);
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
              placeholder="Ask a question or request a visualization..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || loading}
                startIcon={<SendIcon />}
                size="small"
              >
                Ask
              </Button>
              <Button
                variant="outlined"
                onClick={handleVisualize}
                disabled={!inputMessage.trim() || loading}
                startIcon={<VisualizeIcon />}
                size="small"
              >
                Visualize
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelDialog}
      >
        <DialogTitle>
          Visualization Keywords Detected
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your message contains keywords that suggest you might want a visualization (chart/table).
            How would you like to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDialog}>
            Cancel
          </Button>
          <Button onClick={sendAsQuestion} variant="outlined" startIcon={<SendIcon />}>
            Ask as Question
          </Button>
          <Button onClick={handleVisualize} variant="contained" startIcon={<VisualizeIcon />}>
            Visualize
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LLMChat;
