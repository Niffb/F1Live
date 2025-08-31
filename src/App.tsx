import React, { useState, useEffect } from 'react';
import { LiveTiming } from './components/LiveTiming';
import { TelemetryChart } from './components/TelemetryChart';
import { RaceControlPanel } from './components/RaceControlPanel';
import RaceReplay from './components/RaceReplay';

import { DriverSelector } from './components/DriverSelector';
import { SessionSelector } from './components/SessionSelector';
import { openF1Service } from './services/openf1';
import { Session } from './types/f1';
import { Activity, Trophy, MessageSquare, RefreshCw, Play } from 'lucide-react';

function App() {
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | string>('latest');
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<'timing' | 'telemetry' | 'control' | 'replay'>('timing');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchCurrentSession = async () => {
      try {
        if (selectedSessionKey === 'latest') {
          const latestSession = await openF1Service.getLatestSession();
          setCurrentSession(latestSession);
        } else {
          const sessions = await openF1Service.getSessions();
          const session = sessions.find(s => s.session_key === selectedSessionKey);
          setCurrentSession(session || null);
        }
      } catch (error) {
        console.error('Error fetching session info:', error);
      }
    };

    fetchCurrentSession();
  }, [selectedSessionKey]);

  useEffect(() => {
    if (isAutoRefresh) {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAutoRefresh]);

  const tabs = [
    { id: 'timing' as const, label: 'Live Timing', icon: Trophy },
    { id: 'telemetry' as const, label: 'Telemetry', icon: Activity },
    { id: 'control' as const, label: 'Race Control', icon: MessageSquare },
    { id: 'replay' as const, label: 'Race Replay', icon: Play }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-f1-black via-gray-900 to-f1-black">
      {/* Header */}
      <header className="bg-f1-red shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white rounded flex items-center justify-center">
                <span className="text-f1-red font-bold text-lg sm:text-xl">F1</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white">Live Dashboard</h1>
                <p className="text-red-100 text-xs sm:text-sm hidden sm:block">Real-time Formula 1 Data</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-2 text-white">
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isAutoRefresh ? 'animate-spin' : ''}`} />
                <span className="text-xs sm:text-sm">
                  {isAutoRefresh ? 'Live' : 'Paused'}
                </span>
                <button
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className={`w-8 h-5 sm:w-10 sm:h-6 rounded-full transition-colors ${
                    isAutoRefresh ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full transition-transform ${
                    isAutoRefresh ? 'translate-x-4 sm:translate-x-5' : 'translate-x-1'
                  }`}></div>
                </button>
              </div>
              
              {currentSession && (
                <div className="text-right text-white hidden sm:block">
                  <div className="font-semibold text-sm sm:text-base">{currentSession.location}</div>
                  <div className="text-xs sm:text-sm text-red-100">{currentSession.session_name}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile session info */}
          {currentSession && (
            <div className="text-center text-white mt-2 sm:hidden">
              <div className="text-sm font-semibold">{currentSession.location}</div>
              <div className="text-xs text-red-100">{currentSession.session_name}</div>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <SessionSelector
              selectedSessionKey={selectedSessionKey}
              onSessionChange={setSelectedSessionKey}
            />
            
            <DriverSelector
              sessionKey={selectedSessionKey}
              selectedDrivers={selectedDrivers}
              onDriverSelection={setSelectedDrivers}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="bg-f1-black rounded-lg mb-4 sm:mb-6 overflow-hidden">
              <div className="flex">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 transition-colors ${
                        activeTab === tab.id
                          ? 'bg-f1-red text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-semibold text-xs sm:text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'timing' && (
                <LiveTiming sessionKey={selectedSessionKey} selectedDrivers={selectedDrivers} />
              )}
              
              {activeTab === 'telemetry' && (
                <TelemetryChart
                  sessionKey={selectedSessionKey}
                  selectedDrivers={selectedDrivers}
                />
              )}
              
              {activeTab === 'control' && (
                <RaceControlPanel sessionKey={selectedSessionKey} />
              )}
              
              {activeTab === 'replay' && (
                <RaceReplay session={currentSession} selectedDrivers={selectedDrivers} />
              )}
              

            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-f1-black border-t border-gray-800 mt-8 sm:mt-12">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between text-gray-400 text-xs sm:text-sm space-y-2 sm:space-y-0">
            <div className="text-center sm:text-left">
              <p>Data provided by <a href="https://openf1.org" target="_blank" rel="noopener noreferrer" className="text-f1-red hover:underline">OpenF1 API</a></p>
              <p className="mt-1">Last updated: {lastUpdate.toLocaleTimeString()}</p>
            </div>
            <div className="text-center sm:text-right">
              <p>Designed & Developed by <span className="text-f1-red font-semibold">Nathaniel Bareham</span></p>
              <p className="mt-1">Built with React & TypeScript</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
