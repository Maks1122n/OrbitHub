import React, { useState } from 'react';
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
  MenuItem,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { Link, LinkOff, Refresh, Settings } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountProxyApi, AccountWithProxy, AdsPowerStats } from '../services/accountProxyApi';
import { proxyApi, Proxy } from '../services/proxyApi';

const AccountProxyPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [bindDialogOpen, setBingDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithProxy | null>(null);
  const [selectedProxyId, setSelectedProxyId] = useState<string>('');

  // Запрос аккаунтов с прокси
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts-with-proxies'],
    queryFn: accountProxyApi.getAccountsWithProxies
  });

  // Запрос всех прокси для выбора
  const { data: proxiesData } = useQuery({
    queryKey: ['proxies'],
    queryFn: proxyApi.getProxies
  });

  // Запрос статистики AdsPower
  const { data: adsPowerStats } = useQuery({
    queryKey: ['adspower-stats'],
    queryFn: accountProxyApi.getAdsPowerStats
  });

  // Запрос статуса AdsPower
  const { data: adsPowerStatus } = useQuery({
    queryKey: ['adspower-status'],
    queryFn: accountProxyApi.checkAdsPowerStatus,
    refetchInterval: 30000 // проверяем каждые 30 секунд
  });

  // Мутация привязки прокси к аккаунту
  const bindProxyMutation = useMutation({
    mutationFn: ({ accountId, proxyId }: { accountId: string; proxyId: string }) =>
      accountProxyApi.bindProxyToAccount(accountId, proxyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-with-proxies'] });
      queryClient.invalidateQueries({ queryKey: ['adspower-stats'] });
      setBingDialogOpen(false);
      setSelectedAccount(null);
      setSelectedProxyId('');
      toast.success('Аккаунт успешно привязан к прокси и создан AdsPower профиль');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при привязке прокси к аккаунту');
    }
  });

  // Мутация отвязки прокси от аккаунта
  const unbindProxyMutation = useMutation({
    mutationFn: accountProxyApi.unbindProxyFromAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-with-proxies'] });
      queryClient.invalidateQueries({ queryKey: ['adspower-stats'] });
      toast.success('Прокси успешно отвязан от аккаунта');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при отвязке прокси');
    }
  });

  // Мутация обновления AdsPower профиля
  const updateAdsPowerMutation = useMutation({
    mutationFn: accountProxyApi.updateAdsPowerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-with-proxies'] });
      toast.success('AdsPower профиль успешно обновлен');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении AdsPower профиля');
    }
  });

  const handleOpenBindDialog = (account: AccountWithProxy) => {
    setSelectedAccount(account);
    setSelectedProxyId('');
    setBingDialogOpen(true);
  };

  const handleCloseBindDialog = () => {
    setBingDialogOpen(false);
    setSelectedAccount(null);
    setSelectedProxyId('');
  };

  const handleBindProxy = () => {
    if (!selectedAccount || !selectedProxyId) {
      toast.error('Выберите прокси для привязки');
      return;
    }

    bindProxyMutation.mutate({
      accountId: selectedAccount._id,
      proxyId: selectedProxyId
    });
  };

  const handleUnbindProxy = (account: AccountWithProxy) => {
    if (window.confirm(`Отвязать прокси от аккаунта "${account.username}"? Это также удалит AdsPower профиль.`)) {
      unbindProxyMutation.mutate(account._id);
    }
  };

  const handleUpdateAdsPower = (account: AccountWithProxy) => {
    updateAdsPowerMutation.mutate(account._id);
  };

  const getAdsPowerStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'created': return 'success';
      case 'error': return 'error';
      case 'creating': return 'info';
      default: return 'warning';
    }
  };

  const getAdsPowerStatusLabel = (status: string): string => {
    switch (status) {
      case 'created': return 'Создан';
      case 'error': return 'Ошибка';
      case 'creating': return 'Создается';
      default: return 'Не создан';
    }
  };

  const availableProxies = proxiesData?.data.filter(proxy => 
    proxy.status === 'active' && 
    !accounts?.find(account => account.proxyId === proxy._id)
  ) || [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Привязка аккаунтов к прокси
      </Typography>

      {/* Статус AdsPower */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              Статус AdsPower:
            </Typography>
            <Chip 
              label={adsPowerStatus?.available ? 'Подключен' : 'Не подключен'}
              color={adsPowerStatus?.available ? 'success' : 'error'}
            />
            {adsPowerStatus && (
              <Typography variant="body2" color="textSecondary">
                Проверено: {new Date(adsPowerStatus.timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
          
          {!adsPowerStatus?.available && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              AdsPower не подключен. Убедитесь, что AdsPower запущен на вашем компьютере по адресу http://local.adspower.net:50325
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Статистика */}
      {adsPowerStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Всего аккаунтов
                </Typography>
                <Typography variant="h5">
                  {adsPowerStats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  С прокси
                </Typography>
                <Typography variant="h5" color="primary.main">
                  {adsPowerStats.withProxy}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  AdsPower профили
                </Typography>
                <Typography variant="h5" color="success.main">
                  {adsPowerStats.adsPowerCreated}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  С ошибками
                </Typography>
                <Typography variant="h5" color="error.main">
                  {adsPowerStats.adsPowerError}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Таблица аккаунтов */}
      <Card>
        <CardContent>
          {accountsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Аккаунт</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Прокси</TableCell>
                  <TableCell>AdsPower</TableCell>
                  <TableCell>Последняя синхронизация</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts?.map((account) => (
                  <TableRow key={account._id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {account.username}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {account.displayName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={account.status}
                        size="small"
                        color={account.status === 'active' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      {account.proxy ? (
                        <Box>
                          <Typography variant="body2" fontFamily="monospace">
                            {account.proxy.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {account.proxy.host}:{account.proxy.port} ({account.proxy.type})
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Не привязан
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Chip 
                          label={getAdsPowerStatusLabel(account.adsPowerStatus)}
                          color={getAdsPowerStatusColor(account.adsPowerStatus)}
                          size="small"
                        />
                        {account.adsPowerError && (
                          <Tooltip title={account.adsPowerError}>
                            <Typography variant="caption" color="error" sx={{ cursor: 'help' }}>
                              Ошибка (наведите для деталей)
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {account.adsPowerLastSync ? (
                        <Typography variant="caption">
                          {new Date(account.adsPowerLastSync).toLocaleString()}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          Никогда
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!account.proxyId ? (
                          <Tooltip title="Привязать прокси">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBindDialog(account)}
                              color="primary"
                            >
                              <Link />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title="Отвязать прокси">
                              <IconButton
                                size="small"
                                onClick={() => handleUnbindProxy(account)}
                                color="error"
                              >
                                <LinkOff />
                              </IconButton>
                            </Tooltip>
                            {account.adsPowerProfileId && (
                              <Tooltip title="Обновить AdsPower профиль">
                                <IconButton
                                  size="small"
                                  onClick={() => handleUpdateAdsPower(account)}
                                  color="info"
                                >
                                  <Refresh />
                                </IconButton>
                              </Tooltip>
                            )}
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Диалог привязки прокси */}
      <Dialog open={bindDialogOpen} onClose={handleCloseBindDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Привязать прокси к аккаунту "{selectedAccount?.username}"
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              select
              label="Выберите прокси"
              value={selectedProxyId}
              onChange={(e) => setSelectedProxyId(e.target.value)}
            >
              {availableProxies.map((proxy) => (
                <MenuItem key={proxy._id} value={proxy._id}>
                  {proxy.name} ({proxy.host}:{proxy.port}) - {proxy.type.toUpperCase()}
                  {proxy.country && ` - ${proxy.country}`}
                </MenuItem>
              ))}
            </TextField>
            
            {availableProxies.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Нет доступных прокси. Создайте новые прокси или отвяжите существующие.
              </Alert>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              При привязке прокси автоматически создастся профиль в AdsPower с настройками этого прокси.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBindDialog}>
            Отмена
          </Button>
          <Button
            onClick={handleBindProxy}
            variant="contained"
            disabled={!selectedProxyId || bindProxyMutation.isPending}
          >
            {bindProxyMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'Привязать'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountProxyPage; 