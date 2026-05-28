import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { TopNav } from './components/TopNav';
import { NamePromptModal } from './components/NamePromptModal';
import { GroupListPage } from './features/groups/GroupListPage';
import { GroupDetailPage } from './features/group-detail/GroupDetailPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen">
          <TopNav />
          <main className="mx-auto max-w-3xl px-4 py-6">
            <Routes>
              <Route path="/" element={<GroupListPage />} />
              <Route path="/groups/:id" element={<GroupDetailPage />} />
            </Routes>
          </main>
          <NamePromptModal />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
