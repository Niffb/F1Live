import React, { useState, useEffect } from 'react';
import { Session } from '../types/f1';
import { openF1Service } from '../services/openf1';
import { Calendar, MapPin, Clock } from 'lucide-react';

interface SessionSelectorProps {
  selectedSessionKey: number | string;
  onSessionChange: (sessionKey: number | string) => void;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  selectedSessionKey,
  onSessionChange
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const sessionsData = await openF1Service.getSessions(selectedYear);
        
        // Sort sessions by date (most recent first)
        const sortedSessions = sessionsData.sort((a, b) => 
          new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        );
        
        setSessions(sortedSessions);
        
        // Auto-select latest session if none selected
        if (!selectedSessionKey && sortedSessions.length > 0) {
          onSessionChange(sortedSessions[0].session_key);
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [selectedYear, selectedSessionKey, onSessionChange]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionTypeColour = (sessionType: string) => {
    switch (sessionType.toLowerCase()) {
      case 'race': return 'text-f1-red';
      case 'qualifying': return 'text-yellow-400';
      case 'practice': return 'text-blue-400';
      case 'sprint': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const years = [2025, 2024, 2023, 2022, 2021];

  if (loading) {
    return (
      <div className="bg-f1-black rounded-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-40"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-f1-black rounded-lg overflow-hidden">
      <div className="bg-f1-red p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            <h2 className="text-lg sm:text-xl font-bold">Session Selection</h2>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white text-f1-red px-2 sm:px-3 py-1 rounded font-semibold text-sm sm:text-base w-full sm:w-auto"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.session_key}
                onClick={() => onSessionChange(session.session_key)}
                className={`w-full p-3 sm:p-4 text-left hover:bg-gray-800 transition-colors ${
                  selectedSessionKey === session.session_key
                    ? 'bg-f1-red/20 border-l-4 border-l-f1-red'
                    : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="truncate">{session.country_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{formatDate(session.date_start)}</span>
                        <span className="hidden sm:inline">{formatTime(session.date_start)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{session.location}</h3>
                      <span className={`text-xs sm:text-sm font-medium ${getSessionTypeColour(session.session_type)}`}>
                        {session.session_name}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">{session.circuit_short_name}</p>
                  </div>
                  {selectedSessionKey === session.session_key && (
                    <div className="text-f1-red flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No sessions found for {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  );
};

