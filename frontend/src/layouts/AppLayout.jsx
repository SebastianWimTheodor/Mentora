import { useState, useEffect } from 'react';
import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
import { 
  AppShell, 
  Navbar,
  Image, 
  Header, 
  MediaQuery, 
  Burger, 
  Title,
  UnstyledButton,
  Group,
  Text,
  ThemeIcon,
  Box,
  Menu,
  Avatar,
  useMantineColorScheme,
  Button,
  useMantineTheme,
  Badge,
  Divider,
  Paper,
  Transition,
  Stack
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import {
  IconHome2,
  IconPlus,
  IconSettings,
  IconSun,
  IconMoonStars,
  IconLogout,
  IconChartLine,
  IconUser,
  IconInfoCircle,
  IconChevronRight,
  IconSparkles,
  IconShieldCheck,
  IconLanguage
} from '@tabler/icons-react';

const MainLink = ({ icon, color, label, to, isActive, collapsed, onNavigate }) => {
  const navigate = useNavigate();
  const theme = useMantineTheme();
  
  const handleClick = () => {
    navigate(to);
    if (onNavigate) {
      onNavigate(); // Call the callback to close navbar on mobile
    }
  };
  
  return (
    <UnstyledButton
      onClick={handleClick}
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        // Make menu items higher and all the same size
        minHeight: 32,
        height: 48,
        padding: collapsed ? `16px 0` : `16px 16px 16px 16px`, // Adjust padding when collapsed
        borderRadius: theme.radius.md,
        marginBottom: theme.spacing.xs,
        color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,
        backgroundColor: isActive ? 
          (theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[1]) :
          'transparent',
        border: `1px solid ${isActive ? 
          (theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[3]) :
          'transparent'}`,
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      })}
    >
      <Group spacing={collapsed ? 0 : 18} position={collapsed ? "center" : "left"} sx={{ position: 'relative', zIndex: 1, height: '100%', flexWrap: 'nowrap' }}>
        <ThemeIcon 
          color={color} 
          variant="light" 
          size="lg"
          sx={{
            background: `linear-gradient(135deg, ${theme.colors[color][6]}20, ${theme.colors[color][4]}10)`,
            border: `1px solid ${theme.colors[color][6]}30`,
            marginLeft: collapsed ? 0 : 4, // Adjust margins when collapsed
            marginRight: collapsed ? 0 : 8,
          }}
        >
          {icon}
        </ThemeIcon>
        {!collapsed && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Text size="md" weight={600} mb={2} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Text>
            <Box 
              sx={{ 
                height: 3, 
                background: `linear-gradient(90deg, ${theme.colors[color][6]}, ${theme.colors[color][4]})`,
                borderRadius: 2,
                width: isActive ? '100%' : '0%',
                transition: 'width 0.3s ease',
              }} 
            />
          </Box>
        )}
        {!collapsed && (
          <IconChevronRight 
            size={18} 
            style={{ 
              opacity: 0.6,
              transition: 'transform 0.2s ease',
              marginLeft: 8
            }}
          />
        )}
      </Group>
    </UnstyledButton>
  );
};

function AppLayout() {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { t } = useTranslation(['navigation', 'app', 'settings']);
  const dark = colorScheme === 'dark';
  // Check if we're on mobile
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Set default navbar state based on device type - closed on mobile, opened on desktop
  const [opened, setOpened] = useState(!isMobile);
  
  // Update opened state when screen size changes
  useEffect(() => {
    // Only update if the user hasn't manually toggled the navbar
    // This prevents the navbar from changing when the user has specifically set it
    setOpened(!isMobile);
  }, [isMobile]);
  
  // Get current path to determine active link
  const currentPath = window.location.pathname;
  
  // Logic to determine avatar source
  let avatarSrc = null;
  if (user && user.profile_image_base64) {
    if (user.profile_image_base64.startsWith('data:image')) {
      avatarSrc = user.profile_image_base64;
    } else {
      avatarSrc = `data:image/jpeg;base64,${user.profile_image_base64}`;
    }
  }  const mainLinksData = [
    { icon: <IconHome2 size={20} />, color: 'blue', label: t('home', { ns: 'navigation' }), to: '/dashboard' },
    { icon: <IconPlus size={20} />, color: 'teal', label: t('newCourse', { ns: 'navigation' }), to: '/dashboard/create-course' },
    { icon: <IconChartLine size={20} />, color: 'grape', label: t('statistics', { ns: 'navigation' }), to: '/dashboard/statistics' },
    { icon: <IconSettings size={20} />, color: 'grape', label: t('settings', { ns: 'navigation' }), to: '/dashboard/settings' },
    { icon: <IconInfoCircle size={20} />, color: 'gray', label: t('mentora', { ns: 'navigation' }), to: '/' },
    // Admin link - only shown to admin users
    ...(user?.is_admin ? [{ icon: <IconShieldCheck size={20} />, color: 'red', label: t('adminArea', { ns: 'navigation' }), to: '/admin' }] : []),
  ];
  
  // Handler to close navbar on mobile when navigating
  const handleNavigate = () => {
    if (isMobile) {
      setOpened(false);
    }
  };
  
  const mainLinksComponents = mainLinksData.map((link) => (
    <MainLink 
      {...link} 
      key={link.label} 
      isActive={currentPath === link.to}
      collapsed={!opened}
      onNavigate={handleNavigate}
    />
  ));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (    <AppShell
      styles={{
        main: {
          background: dark ? theme.colors.dark[8] : theme.colors.gray[0],
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',
          paddingRight: 0, // Remove default padding to account for the right toolbar
          overflowX: 'hidden',
        },
      }}
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"      header={
        <Header 
          height={{ base: 60, md: 70 }} 
          p="md"
          sx={(theme) => ({
            background: dark 
              ? `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`
              : `linear-gradient(135deg, ${theme.white} 0%, ${theme.colors.gray[0]} 100%)`,
            borderBottom: `1px solid ${dark ? theme.colors.dark[6] : theme.colors.gray[2]}`,
            boxShadow: dark 
              ? `0 4px 12px ${theme.colors.dark[9]}50`
              : `0 4px 12px ${theme.colors.gray[3]}30`,
            zIndex: 200, // Higher than navbar (150) and toolbar (100)
            position: 'relative', // Ensure stacking context
          })}
        ><div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Burger
              opened={opened}
              onClick={() => setOpened((o) => !o)}
              size="sm"
              color={theme.colors.gray[6]}
              mr="xl"
              sx={{
                transition: 'transform 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
                display: 'flex', // Ensure it's always visible
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={t('burgerAriaLabel', { ns: 'app', defaultValue: 'Toggle navigation' })}
            />

            <Group spacing="xs">
              
              <IconSparkles 
                size={28} 
                style={{ 
                  color: theme.colors.violet[5],
                  filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3))',
                }} 
              />              <Title
                order={3}
                size="1.6rem"
                component={RouterLink}
                to={user ? "/dashboard" : "/"}
                sx={(theme) => ({
                  textDecoration: 'none',
                  background: `linear-gradient(135deg, ${theme.colors.violet[6]}, ${theme.colors.violet[4]})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  transition: 'all 0.3s ease',
                  filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.2))',
                  '&:hover': {
                    transform: 'scale(1.02)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.4))',
                  },
                })}
              >
                {t('title', { ns: 'app' })}
              </Title>
            </Group>
            
            <Box sx={{ flexGrow: 1 }} /> {/* Spacer */}
            
            <Group spacing="xs">
              {user ? (
                <Menu shadow="md" width={220} withinPortal={true} zIndex={300}>
                  <Menu.Target>
                    <UnstyledButton
                      sx={{
                        padding: theme.spacing.xs,
                        borderRadius: theme.radius.md,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                          transform: 'scale(1.02)',
                        },
                      }}
                    > 
                      <Group spacing="xs"> 
                        <Avatar
                          key={avatarSrc || (user ? user.id : 'app-layout-avatar')}
                          src={avatarSrc}
                          radius="xl"
                          alt={user.username || t('userAvatarAlt', { ns: 'app', defaultValue: 'User avatar' })}
                          color="cyan"
                          sx={{
                            cursor: 'pointer',
                            border: `2px solid ${theme.colors.cyan[5]}40`,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              border: `2px solid ${theme.colors.cyan[5]}`,
                            },
                          }}
                        >
                          {!avatarSrc && user.username ? user.username.substring(0, 2).toUpperCase() : (!avatarSrc ? <IconUser size={18} /> : null)}
                        </Avatar>
                        <Box>
                          <Text size="sm" weight={500}>{user.username}</Text>
                          <Badge 
                            size="xs" 
                            variant="light" 
                            color="cyan"
                            sx={{ textTransform: 'none' }}
                          >
                            {t('onlineStatusBadge', { ns: 'app', defaultValue: 'Online' })}
                          </Badge>
                        </Box>
                      </Group>
                    </UnstyledButton>
                  </Menu.Target> 
                    <Menu.Dropdown
                    sx={{
                      border: `1px solid ${dark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                      boxShadow: dark 
                        ? `0 8px 24px ${theme.colors.dark[9]}70`
                        : `0 8px 24px ${theme.colors.gray[4]}40`,
                      zIndex: 300, // Much higher than navbar (150) and toolbar (100)
                    }}
                  >
                      <Menu.Item 
                      icon={<IconSettings size={14} />} 
                      onClick={() => navigate('/dashboard/settings')}
                      sx={{
                        '&:hover': {
                          backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                        },
                      }}
                    >
                      {t('settings', { ns: 'navigation' })}
                    </Menu.Item>                    <Menu.Item 
                      icon={dark ? <IconSun size={14} /> : <IconMoonStars size={14} />} 
                      onClick={() => toggleColorScheme()}
                      sx={{
                        '&:hover': {
                          backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                        },
                      }}
                    >
                      {t('theme', { ns: 'settings' })}
                    </Menu.Item>

                    <Menu.Item 
                      icon={ <IconInfoCircle size={14} />} 
                      onClick={() => {navigate('/about');}}
                      sx={{
                        '&:hover': {
                          backgroundColor: dark ? theme.colors.dark[6] : theme.colors.gray[1],
                        },
                      }}
                    >
                      {t('about', { ns: 'navigation' })}
                    </Menu.Item>

                    <Divider />                    <Menu.Item 
                      icon={<IconLogout size={14} />} 
                      onClick={handleLogout}
                      color="red"
                      sx={{
                        '&:hover': {
                          backgroundColor: `${theme.colors.red[6]}15`,
                        },
                      }}
                    >
                      {t('logout', { ns: 'navigation' })}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Button 
                  onClick={() => navigate('/login')}
                  variant="gradient"
                  gradient={{ from: 'violet', to: 'blue' }}
                  sx={{
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}                >
                  {t('login', { ns: 'navigation' })}
                </Button>
              )}
            </Group>
          </div>
        </Header>
      }      navbar={       
        
        <Navbar 
          p={opened ? "md" : "xs"}
          hiddenBreakpoint="sm" 
          hidden={isMobile && !opened} // Hide completely on mobile when closed
          width={{ sm: opened ? 250 : (isMobile ? 0 : 80), lg: opened ? 300 : (isMobile ? 0 : 80) }}
          sx={(theme) => ({
            background: dark 
              ? `linear-gradient(180deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[8]} 100%)`
              : `linear-gradient(180deg, ${theme.white} 0%, ${theme.colors.gray[0]} 100%)`,
            borderRight: `1px solid ${dark ? theme.colors.dark[5] : theme.colors.gray[2]}`,
            boxShadow: dark 
              ? `4px 0 12px ${theme.colors.dark[9]}30`
              : `4px 0 12px ${theme.colors.gray[3]}20`,
            transition: 'width 0.3s ease, padding 0.3s ease',
            display: (isMobile && !opened) ? 'none' : 'flex', // Completely hide on mobile when closed
            flexDirection: 'column',
            zIndex: 150, // Higher than toolbar (100)
          })}
        >
          <Navbar.Section>
            <Paper
              p="md"
              sx={(theme) => ({
                background: dark 
                  ? `linear-gradient(135deg, ${theme.colors.dark[6]}80, ${theme.colors.dark[5]}40)`
                  : `linear-gradient(135deg, ${theme.colors.gray[1]}80, ${theme.white}40)`,
                border: `1px solid ${dark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                borderRadius: theme.radius.lg,
                marginBottom: theme.spacing.lg,
                backdropFilter: 'blur(8px)',
              })}
            >     
            
            <Group spacing="sm" mb="xs" position={!opened ? "center" : "left"}>
              <Group spacing="xs" position="center">
                    <Image
                      src="/logo.png"
                      alt={t('app:logoAlt')}
                      height={85}
                      width={85}
                    />
                  </Group>
                {opened && (
                  <Box>                    <Text size="sm" weight={600} mb={2}>{t('title', { ns: 'navigation', defaultValue: 'Navigation' })}</Text>
                    <Text size="xs" color="dimmed">{t('subtitle', { ns: 'navigation', defaultValue: 'Choose your destination' })}</Text>
                  </Box>
                )}
              </Group>
            </Paper>
          </Navbar.Section>
          
          <Navbar.Section grow mt="xs">
            <Stack spacing="xs">
              {mainLinksComponents}
            </Stack>
          </Navbar.Section>
        </Navbar>
      }
    >
      <Outlet />
    </AppShell>
  );
}

export default AppLayout;