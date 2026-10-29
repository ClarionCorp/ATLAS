import { Outlet, useNavigate } from 'react-router-dom';

export interface AppContextType {
  navigate: ReturnType<typeof useNavigate>;
}

function App() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-12">
      <div className="flex">
        <main className="flex-1">
          <Outlet context={{
            navigate,
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default App;