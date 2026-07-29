import { PracticeProvider } from './features/practice/PracticeProvider';
import PracticeScreen from './features/practice/PracticeScreen';
import { SessionProvider } from './features/session/SessionProvider';

export default function Home() {
  return (
    <SessionProvider>
      <PracticeProvider>
        <PracticeScreen />
      </PracticeProvider>
    </SessionProvider>
  );
}
