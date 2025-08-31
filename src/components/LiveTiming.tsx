import React, { useState, useEffect, useCallback } from 'react';
import { Driver, Position, Lap } from '../types/f1';
import { openF1Service } from '../services/openf1';
import { Trophy, Clock, Flag } from 'lucide-react';

interface LiveTimingProps {
  sessionKey: number | string;
  selectedDrivers?: number[];
}

interface DriverTimingData {
  driver: Driver;
  position: Position | null;
  latestLap: Lap | null;
}

export const LiveTiming: React.FC<LiveTimingProps> = ({ sessionKey, selectedDrivers = [] }) => {
  const [timingData, setTimingData] = useState<DriverTimingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimingData = useCallback(async () => {
    try {
      setError(null);
      const [drivers, positions, laps] = await Promise.all([
        openF1Service.getDrivers(sessionKey),
        openF1Service.getPositions(sessionKey),
        openF1Service.getLaps(sessionKey)
      ]);

      const timingMap = new Map<number, DriverTimingData>();

      drivers.forEach(driver => {
        timingMap.set(driver.driver_number, {
          driver,
          position: null,
          latestLap: null
        });
      });

      positions.forEach(position => {
        const data = timingMap.get(position.driver_number);
        if (data && (!data.position || new Date(position.date) > new Date(data.position.date))) {
          data.position = position;
        }
      });

      laps.forEach(lap => {
        const data = timingMap.get(lap.driver_number);
        if (data && (!data.latestLap || lap.lap_number > data.latestLap.lap_number)) {
          data.latestLap = lap;
        }
      });

      let sortedData = Array.from(timingMap.values())
        .filter(data => data.position)
        .sort((a, b) => (a.position?.position || 999) - (b.position?.position || 999));

      // Filter by selected drivers if any are selected
      if (selectedDrivers.length > 0) {
        sortedData = sortedData.filter(data => 
          selectedDrivers.includes(data.driver.driver_number)
        );
      }

      setTimingData(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch timing data');
    } finally {
      setLoading(false);
    }
  }, [sessionKey, selectedDrivers]);

  useEffect(() => {
    fetchTimingData();
    const interval = setInterval(fetchTimingData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [fetchTimingData]);

  const formatLapTime = (duration: number | null): string => {
    if (!duration) return '--:--.---';
    const minutes = Math.floor(duration / 60);
    const seconds = (duration % 60).toFixed(3);
    return `${minutes}:${seconds.padStart(6, '0')}`;
  };

  const getPositionColour = (position: number): string => {
    if (position === 1) return 'text-yellow-400';
    if (position === 2) return 'text-gray-300';
    if (position === 3) return 'text-orange-400';
    if (position <= 10) return 'text-green-400';
    return 'text-white';
  };

  if (loading) {
    return (
      <div className="bg-f1-black rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-f1-red"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-f1-black rounded-lg p-6">
        <div className="text-f1-red text-center">
          <p>Error loading timing data: {error}</p>
          <button 
            onClick={fetchTimingData}
            className="mt-4 bg-f1-red text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-f1-black rounded-lg overflow-hidden">
      <div className="bg-f1-red p-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6" />
          <h2 className="text-xl font-bold">Live Timing</h2>
        </div>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">Pos</th>
              <th className="px-4 py-3 text-left">Driver</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-left">Last Lap</th>
              <th className="px-4 py-3 text-left">Lap</th>
              <th className="px-4 py-3 text-left">S1</th>
              <th className="px-4 py-3 text-left">S2</th>
              <th className="px-4 py-3 text-left">S3</th>
            </tr>
          </thead>
          <tbody>
            {timingData.map((data, index) => (
              <tr 
                key={data.driver.driver_number} 
                className={`border-b border-gray-700 hover:bg-gray-800 ${
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-f1-black'
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`font-bold text-lg ${getPositionColour(data.position?.position || 999)}`}>
                    {data.position?.position || '--'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-8 rounded"
                      style={{ backgroundColor: `#${data.driver.team_colour}` }}
                    ></div>
                    <div>
                      <div className="font-semibold">{data.driver.name_acronym}</div>
                      <div className="text-sm text-gray-400">{data.driver.driver_number}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{data.driver.team_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-mono">
                      {formatLapTime(data.latestLap?.lap_duration || null)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Flag className="w-4 h-4 text-gray-400" />
                    <span>{data.latestLap?.lap_number || '--'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">
                    {formatLapTime(data.latestLap?.duration_sector_1 || null)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">
                    {formatLapTime(data.latestLap?.duration_sector_2 || null)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">
                    {formatLapTime(data.latestLap?.duration_sector_3 || null)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-2 p-4">
        {timingData.map((data, index) => (
          <div 
            key={data.driver.driver_number}
            className={`border border-gray-700 rounded-lg p-3 ${
              index % 2 === 0 ? 'bg-gray-900' : 'bg-f1-black'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`font-bold text-xl ${getPositionColour(data.position?.position || 999)}`}>
                  {data.position?.position || '--'}
                </span>
                <div 
                  className="w-3 h-6 rounded"
                  style={{ backgroundColor: `#${data.driver.team_colour}` }}
                ></div>
                <div>
                  <div className="font-semibold text-lg">{data.driver.name_acronym}</div>
                  <div className="text-xs text-gray-400">#{data.driver.driver_number}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm">
                  <Flag className="w-3 h-3 text-gray-400" />
                  <span>Lap {data.latestLap?.lap_number || '--'}</span>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-gray-400 mb-2">{data.driver.team_name}</div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Last Lap</div>
                <div className="font-mono text-lg">
                  {formatLapTime(data.latestLap?.lap_duration || null)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs">Sectors</div>
                <div className="font-mono text-xs space-y-1">
                  <div>S1: {formatLapTime(data.latestLap?.duration_sector_1 || null)}</div>
                  <div>S2: {formatLapTime(data.latestLap?.duration_sector_2 || null)}</div>
                  <div>S3: {formatLapTime(data.latestLap?.duration_sector_3 || null)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {timingData.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          <p>No timing data available for this session</p>
        </div>
      )}
    </div>
  );
};
