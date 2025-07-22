import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  Chip, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { Add, Edit, Delete, PlayArrow, Refresh } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { proxyApi, Proxy, ProxyStats } from '../services/proxyApi';

interface ProxyFormData {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  type: 'http' | 'https' | 'socks5';
  country: string;
  city: string;
  provider: string;
}

const ProxyPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProxyFormData>({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    type: 'http',
    country: '',
    city: '',
    provider: ''
  });

  // Запрос списка прокси
  const { data: proxiesData, isLoading: proxiesLoading } = useQuery({
    queryKey: ['proxies'],
    queryFn: proxyApi.getProxies
  });

  // Запрос статистики прокси
  const { data: stats } = useQuery({
    queryKey: ['proxy-stats'],
    queryFn: proxyApi.getProxyStats
  });

  // Мутация создания прокси
  const createProxyMutation = useMutation({
    mutationFn: proxyApi.createProxy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-stats'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Прокси успешно создан');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при создании прокси');
    }
  });

  // Мутация обновления прокси
  const updateProxyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Proxy> }) => 
      proxyApi.updateProxy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
      setDialogOpen(false);
      setEditingProxy(null);
      resetForm();
      toast.success('Прокси успешно обновлен');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении прокси');
    }
  });

  // Мутация удаления прокси
  const deleteProxyMutation = useMutation({
    mutationFn: proxyApi.deleteProxy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-stats'] });
      toast.success('Прокси успешно удален');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при удалении прокси');
    }
  });

  // Мутация тестирования прокси
  const testProxyMutation = useMutation({
    mutationFn: proxyApi.testProxy,
    onSuccess: (result, proxyId) => {
      setTestingProxy(null);
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
      
      if (result.success) {
        toast.success(`Прокси работает! IP: ${result.ip}, Время отклика: ${result.responseTime}ms`);
      } else {
        toast.error(`Прокси не работает: ${result.error}`);
      }
    },
    onError: (error: any) => {
      setTestingProxy(null);
      toast.error(error.response?.data?.error || 'Ошибка при тестировании прокси');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '',
      username: '',
      password: '',
      type: 'http',
      country: '',
      city: '',
      provider: ''
    });
  };

  const handleOpenDialog = (proxy?: Proxy) => {
    if (proxy) {
      setEditingProxy(proxy);
      setFormData({
        name: proxy.name,
        host: proxy.host,
        port: proxy.port.toString(),
        username: proxy.username || '',
        password: proxy.password || '',
        type: proxy.type,
        country: proxy.country || '',
        city: proxy.city || '',
        provider: proxy.provider || ''
      });
    } else {
      setEditingProxy(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProxy(null);
    resetForm();
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.host || !formData.port) {
      toast.error('Заполните обязательные поля');
      return;
    }

    const proxyData = {
      ...formData,
      port: parseInt(formData.port),
      status: 'active' as const,
      isWorking: true
    };

    if (editingProxy) {
      updateProxyMutation.mutate({ id: editingProxy._id, data: proxyData });
    } else {
      createProxyMutation.mutate(proxyData);
    }
  };

  const handleDelete = (proxy: Proxy) => {
    if (window.confirm(`Вы уверены, что хотите удалить прокси "${proxy.name}"?`)) {
      deleteProxyMutation.mutate(proxy._id);
    }
  };

  const handleTest = (proxy: Proxy) => {
    setTestingProxy(proxy._id);
    testProxyMutation.mutate(proxy._id);
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' => {
    switch (status) {
      case 'active': return 'success';
      case 'error': return 'error';
      default: return 'warning';
    }
  };

  const getStatusLabel = (status: string, isWorking: boolean): string => {
    if (status === 'active' && isWorking) return 'Работает';
    if (status === 'active' && !isWorking) return 'Не проверен';
    if (status === 'error') return 'Ошибка';
    return 'Неактивен';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Управление прокси
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Добавить прокси
        </Button>
      </Box>

      {/* Статистика */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Всего прокси
                </Typography>
                <Typography variant="h5">
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Активные
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.active}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Работающие
                </Typography>
                <Typography variant="h5" color="primary.main">
                  {stats.working}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  С ошибками
                </Typography>
                <Typography variant="h5" color="error.main">
                  {stats.error}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Неактивные
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {stats.inactive}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Таблица прокси */}
      <Card>
        <CardContent>
          {proxiesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Адрес</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Страна</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Провайдер</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {proxiesData?.data.map((proxy) => (
                  <TableRow key={proxy._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {proxy.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {proxy.host}:{proxy.port}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={proxy.type.toUpperCase()} size="small" />
                    </TableCell>
                    <TableCell>{proxy.country || '—'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(proxy.status, proxy.isWorking)}
                        color={getStatusColor(proxy.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{proxy.provider || '—'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Тестировать">
                          <IconButton
                            size="small"
                            onClick={() => handleTest(proxy)}
                            disabled={testingProxy === proxy._id}
                          >
                            {testingProxy === proxy._id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <PlayArrow />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Редактировать">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(proxy)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(proxy)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования прокси */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingProxy ? 'Редактировать прокси' : 'Добавить прокси'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                fullWidth
                label="Хост *"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Порт *"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Логин"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Пароль"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                select
                label="Тип"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <MenuItem value="http">HTTP</MenuItem>
                <MenuItem value="https">HTTPS</MenuItem>
                <MenuItem value="socks5">SOCKS5</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Страна"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Город"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Провайдер"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createProxyMutation.isPending || updateProxyMutation.isPending}
          >
            {createProxyMutation.isPending || updateProxyMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              editingProxy ? 'Обновить' : 'Создать'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProxyPage; 