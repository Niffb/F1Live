import React, { useState, useEffect, useCallback } from 'react';
import { RaceControl, Weather } from '../types/f1';
import { openF1Service } from '../services/openf1';
import { AlertTriangle, Flag, MessageSquare, Cloud, Thermometer, Wind } from 'lucide-react';

interface RaceControlPanelProps {
  sessionKey: number | string;
}

export const RaceControlPanel: React.FC<RaceControlPanelProps> = ({ sessionKey }) => {
  const [raceControlMessages, setRaceControlMessages] = useState<RaceControl[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [raceControlData, weatherData] = await Promise.all([
        openF1Service.getRaceControl(sessionKey),
        openF1Service.getWeather(sessionKey)
      ]);

      setRaceControlMessages(raceControlData.slice(-15)); // Last 15 messages
      setWeather(weatherData.length > 0 ? weatherData[weatherData.length - 1] : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch race control data');
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const getMessageIcon = (category: string, flag: string | null) => {
    if (flag) {
      switch (flag.toLowerCase()) {
        case 'yellow':
          return <Flag className="w-4 h-4 text-yellow-400" />;
        case 'red':
          return <Flag className="w-4 h-4 text-red-500" />;
        case 'green':
          return <Flag className="w-4 h-4 text-green-400" />;
        case 'chequered':
          return <Flag className="w-4 h-4 text-white" />;
        default:
          return <Flag className="w-4 h-4 text-gray-400" />;
      }
    }
    
    switch (category.toLowerCase()) {
      case 'flag':
        return <Flag className="w-4 h-4 text-gray-400" />;
      case 'drs':
        return <Thermometer className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    }
  };

  const getMessageColour = (category: string, flag: string | null) => {
    if (flag) {
      switch (flag.toLowerCase()) {
        case 'yellow': return 'border-l-yellow-400 bg-yellow-400/10';
        case 'red': return 'border-l-red-500 bg-red-500/10';
        case 'green': return 'border-l-green-400 bg-green-400/10';
        case 'chequered': return 'border-l-white bg-gray-500/10';
        default: return 'border-l-gray-400 bg-gray-400/10';
      }
    }
    return 'border-l-blue-400 bg-blue-400/10';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-f1-black rounded-lg p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-f1-red"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-f1-black rounded-lg p-6">
        <div className="text-f1-red text-center">
          <p>Error loading data: {error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 bg-f1-red text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Weather Widget */}
      {weather && (
        <div className="bg-f1-black rounded-lg overflow-hidden">
          <div className="bg-blue-600 p-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              <h3 className="font-bold">Weather Conditions</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-orange-400">
                  <Thermometer className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Air</span>
                </div>
                <div className="text-lg sm:text-xl font-bold">{weather.air_temperature}°C</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-red-400">
                  <Thermometer className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Track</span>
                </div>
                <div className="text-lg sm:text-xl font-bold">{weather.track_temperature}°C</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-blue-400">
                  <Wind className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Wind</span>
                </div>
                <div className="text-lg sm:text-xl font-bold">{weather.wind_speed} m/s</div>
                <div className="text-xs text-gray-400">{weather.wind_direction}°</div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-400">Humidity</div>
                <div className="text-lg sm:text-xl font-bold">{weather.humidity}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Race Control Messages */}
      <div className="bg-f1-black rounded-lg overflow-hidden">
        <div className="bg-f1-red p-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h3 className="font-bold">Race Control</h3>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {raceControlMessages.length > 0 ? (
            <div className="space-y-1">
              {raceControlMessages.reverse().map((message, index) => (
                <div 
                  key={index}
                  className={`p-3 border-l-4 ${getMessageColour(message.category, message.flag)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getMessageIcon(message.category, message.flag)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        <span>{formatTime(message.date)}</span>
                        {message.lap_number && (
                          <span>Lap {message.lap_number}</span>
                        )}
                        {message.driver_number && (
                          <span>Car {message.driver_number}</span>
                        )}
                      </div>
                      <p className="text-white text-sm">{message.message}</p>
                      {message.flag && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-700">
                            {message.flag.toUpperCase()} FLAG
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No race control messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
