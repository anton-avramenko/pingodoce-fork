import Layout from '@/components/Layout';

/**
 * Hidden configuration route.
 * Not linked from the main navigation — open /setup directly, or tap the
 * profile icon in the top bar 5 times quickly.
 */
export default function SetupPage() {
  return <Layout startInSetup initialTab="home" />;
}
