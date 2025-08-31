import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Settings, Rewind, FastForward, Flag, Wrench, Trophy, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { openF1Service } from '../services/openf1';
import { Session, Driver, Position, Lap, RaceControl } from '../types/f1';

interface RaceReplayProps {
  session: Session | null;
}

interface PositionChartData {
  timestamp: string;
  lapNumber: number;
  totalLaps: number;
  positions: {
    driver_number: number;
    position: number;
    progress: number; // 0-1 representing race completion
    team_colour: string;
    name_acronym: string;
    full_name: string;
    pit_stops: number;
    is_in_pit: boolean;
    last_lap_time: number | null;
    sector_1_time: number | null;
    sector_2_time: number | null;
    sector_3_time: number | null;
    current_lap_number: number;
    interpolated_position?: number; // For smooth position transitions
    position_change?: number; // Track position changes for visual feedback
  }[];
  flags: {
    type: string;
    message: string;
    driver_number?: number;
  }[];
}

const RaceReplay: React.FC<RaceReplayProps> = ({ session }) => {
  const [chartData, setChartData] = useState<PositionChartData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [customSpeed, setCustomSpeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [showMetrics, setShowMetrics] = useState(true);
  const [animationProgress, setAnimationProgress] = useState(0);

  const animationRef = useRef<number>(0);

  const speedOptions = [
    { value: 0.5, label: '0.5x', icon: Rewind },
    { value: 1, label: '1x', icon: Play },
    { value: 2, label: '2x', icon: FastForward }
  ];

  const loadReplayData = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const [drivers, positions, laps, raceControl] = await Promise.all([
        openF1Service.getDrivers(session.session_key),
        openF1Service.getPositions(session.session_key),
        openF1Service.getLaps(session.session_key),
        openF1Service.getRaceControl(session.session_key)
      ]);

      if (drivers.length === 0) {
        throw new Error('No driver data available for this session');
      }

      // Get qualifying positions (starting grid)
      const qualifyingData = await getQualifyingPositions(session, drivers);

      // Process race data into position chart format
      const processedData = processRaceData(drivers, positions, laps, qualifyingData, raceControl);
      setChartData(processedData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load race data');
      console.error('Error loading replay data:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const getQualifyingPositions = async (session: Session, drivers: Driver[]): Promise<{ [key: number]: number }> => {
    try {
      // Try to get qualifying session for this meeting
      const sessions = await openF1Service.getSessions(session.year, session.meeting_key);
      const qualifyingSession = sessions.find(s => 
        s.session_name.toLowerCase().includes('qualifying') || 
        s.session_name.toLowerCase().includes('sprint_shootout')
      );

      if (qualifyingSession) {
        const qualifyingPositions = await openF1Service.getPositions(qualifyingSession.session_key);
        const finalQualifyingPositions: { [key: number]: number } = {};
        
        // Get the final qualifying position for each driver
        qualifyingPositions.forEach(pos => {
          if (!finalQualifyingPositions[pos.driver_number] || 
              new Date(pos.date) > new Date(qualifyingPositions.find(p => 
                p.driver_number === pos.driver_number && 
                finalQualifyingPositions[pos.driver_number] === p.position
              )?.date || '')) {
            finalQualifyingPositions[pos.driver_number] = pos.position;
          }
        });

        return finalQualifyingPositions;
      }
    } catch (error) {
      console.warn('Could not load qualifying data, using driver numbers for grid order');
    }

    // Fallback: use driver numbers as grid positions
    const fallbackPositions: { [key: number]: number } = {};
    drivers.forEach((driver, index) => {
      fallbackPositions[driver.driver_number] = index + 1;
    });
    return fallbackPositions;
  };

  const processRaceData = (
    drivers: Driver[], 
    positions: Position[], 
    laps: Lap[], 
    qualifyingPositions: { [key: number]: number },
    raceControl: RaceControl[]
  ): PositionChartData[] => {
    // Find total laps and create time-based data structure
    const maxLap = Math.max(...laps.map(l => l.lap_number), 1);
    const chartData: PositionChartData[] = [];

    // Filter out drivers who didn't finish (DNF)
    const finishingDrivers = drivers.filter(driver => {
      const driverLaps = laps.filter(lap => lap.driver_number === driver.driver_number);
      return driverLaps.length > 3; // Only show drivers who completed at least 3 laps
    });

    // Create time-based progression using individual lap completions
    const allLapCompletions: Array<{
      timestamp: string;
      driver_number: number;
      lap_number: number;
      cumulative_time: number;
      position: number;
    }> = [];

    // Calculate cumulative race time for each driver's lap completion
    finishingDrivers.forEach(driver => {
      const driverLaps = laps
        .filter(lap => lap.driver_number === driver.driver_number && lap.lap_duration !== null)
        .sort((a, b) => a.lap_number - b.lap_number);
      
      let cumulativeTime = 0;
      driverLaps.forEach(lap => {
        cumulativeTime += lap.lap_duration || 0;
        allLapCompletions.push({
          timestamp: lap.date_start,
          driver_number: driver.driver_number,
          lap_number: lap.lap_number,
          cumulative_time: cumulativeTime,
          position: positions.find(p => 
            p.driver_number === driver.driver_number && 
            Math.abs(new Date(p.date).getTime() - new Date(lap.date_start).getTime()) < 60000
          )?.position || qualifyingPositions[driver.driver_number] || driver.driver_number
        });
      });
    });

    // Sort all lap completions by timestamp to create chronological progression
    allLapCompletions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Create frames based on lap numbers for proper race progression
    const timeIntervals = Math.min(maxLap * 2, 100); // Two frames per lap, capped at 100 for performance
    const startTime = allLapCompletions.length > 0 ? new Date(allLapCompletions[0].timestamp).getTime() : Date.now();
    const endTime = allLapCompletions.length > 0 ? new Date(allLapCompletions[allLapCompletions.length - 1].timestamp).getTime() : Date.now() + 1000;
    const timeStep = (endTime - startTime) / timeIntervals;

    // Calculate global progress baseline to avoid jerky movements
    const raceProgressPerFrame = 1 / timeIntervals;

    // Keep track of driver states
    const driverStates = new Map<number, {
      position: number;
      lap_number: number;
      cumulative_time: number;
      pit_stops: number;
      is_in_pit: boolean;
      baseline_progress: number;
    }>();

    // Initialize driver states
    finishingDrivers.forEach(driver => {
      driverStates.set(driver.driver_number, {
        position: qualifyingPositions[driver.driver_number] || driver.driver_number,
        lap_number: 0,
        cumulative_time: 0,
        pit_stops: 0,
        is_in_pit: false,
        baseline_progress: 0
      });
    });

    for (let i = 0; i <= timeIntervals; i++) {
      const currentTime = startTime + (i * timeStep);
      const frameTimestamp = new Date(currentTime).toISOString();
      const globalProgress = i * raceProgressPerFrame; // Steady baseline progress

      // Update driver states based on lap completions up to this time
      allLapCompletions.forEach(completion => {
        const completionTime = new Date(completion.timestamp).getTime();
        if (completionTime <= currentTime) {
          const driverState = driverStates.get(completion.driver_number);
          if (driverState && completion.lap_number > driverState.lap_number) {
            driverState.lap_number = completion.lap_number;
            driverState.cumulative_time = completion.cumulative_time;
            driverState.position = completion.position;
            
            // Check for pit stops
            const pitLap = laps.find(lap => 
              lap.driver_number === completion.driver_number && 
              lap.lap_number === completion.lap_number && 
              lap.is_pit_out_lap
            );
            if (pitLap) {
              driverState.pit_stops++;
              driverState.is_in_pit = true;
            } else {
              driverState.is_in_pit = false;
            }
          }
        }
      });

      // Get flags for this time
      const currentFlags = raceControl.filter(rc => {
        const flagTime = new Date(rc.date).getTime();
        return Math.abs(flagTime - currentTime) < 30000 && (rc.flag || rc.category === 'Flag');
      }).map(rc => ({
        type: rc.flag || 'FLAG',
        message: rc.message,
        driver_number: rc.driver_number || undefined
      }));

      // Create position data for finishing drivers with improved progress calculation
      const chartPositions = finishingDrivers.map(driver => {
        const driverState = driverStates.get(driver.driver_number);
        if (!driverState) return null;

        // Calculate progress using a blend of lap-based and time-based progress
        let progress = 0;
        if (driverState.lap_number > 0) {
          // Base progress on laps completed
          const lapProgress = driverState.lap_number / maxLap;
          
          // Apply small variations based on position but keep it smooth
          const positionModifier = (20 - driverState.position) * 0.002; // Small adjustment
          progress = Math.min(lapProgress + positionModifier, 1);
          
          // Ensure minimum progress movement
          progress = Math.max(progress, globalProgress * 0.8); // Never fall too far behind global progress
        } else {
          // For drivers who haven't completed laps, use baseline progress
          progress = Math.max(globalProgress * 0.1, 0.01);
        }

        // Update baseline progress to ensure smooth movement
        driverState.baseline_progress = Math.max(driverState.baseline_progress, progress);
        progress = driverState.baseline_progress;

        // Get latest lap data for timing information
        const driverLapsUpToNow = laps.filter(lap => 
          lap.driver_number === driver.driver_number && 
          new Date(lap.date_start).getTime() <= currentTime
        ).sort((a, b) => b.lap_number - a.lap_number);
        
        const latestLap = driverLapsUpToNow[0];

        return {
          driver_number: driver.driver_number,
          position: driverState.position,
          progress: Math.max(progress, 0.01),
          team_colour: driver.team_colour || '#ffffff',
          name_acronym: driver.name_acronym || `D${driver.driver_number}`,
          full_name: driver.full_name || `Driver ${driver.driver_number}`,
          pit_stops: driverState.pit_stops,
          is_in_pit: driverState.is_in_pit,
          last_lap_time: latestLap?.lap_duration || null,
          sector_1_time: latestLap?.duration_sector_1 || null,
          sector_2_time: latestLap?.duration_sector_2 || null,
          sector_3_time: latestLap?.duration_sector_3 || null,
          current_lap_number: driverState.lap_number
        };
      }).filter(Boolean) as any[];

      // Sort by position
      chartPositions.sort((a, b) => a.position - b.position);

      // Determine current lap number
      const currentLap = Math.max(...Array.from(driverStates.values()).map(s => s.lap_number), 1);

      chartData.push({
        timestamp: frameTimestamp,
        lapNumber: currentLap,
        totalLaps: maxLap,
        positions: chartPositions,
        flags: currentFlags
      });
    }

    return chartData;
  };



  const interpolateDriverPositions = (
    prevFrame: PositionChartData | null,
    currentFrame: PositionChartData,
    progress: number
  ) => {
    if (!prevFrame || progress >= 1) return currentFrame.positions;

    return currentFrame.positions.map(currentDriver => {
      const prevDriver = prevFrame.positions.find(p => p.driver_number === currentDriver.driver_number);
      
      if (!prevDriver) return currentDriver;

      // Smooth interpolation between positions and progress
      const interpolatedProgress = prevDriver.progress + (currentDriver.progress - prevDriver.progress) * progress;
      
      // Smooth interpolation for position changes (for visual ordering)
      const interpolatedPosition = prevDriver.position + (currentDriver.position - prevDriver.position) * progress;
      
      return {
        ...currentDriver,
        progress: interpolatedProgress,
        interpolated_position: interpolatedPosition, // Add interpolated position for smooth transitions
        position_change: currentDriver.position - prevDriver.position // Track position changes
      };
    });
  };

  useEffect(() => {
    if (isPlaying && chartData.length > 0) {
      let lastTime = performance.now();
      
      const animate = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        setAnimationProgress(prev => {
          // Use frame rate independent animation
          const increment = (deltaTime / 1000) * 0.5 * playbackSpeed; // 0.5 seconds per frame at 1x speed (much slower)
          if (prev >= 1) {
            // Move to next frame
            setCurrentIndex(prevIndex => {
              if (prevIndex >= chartData.length - 1) {
                setIsPlaying(false);
                return prevIndex;
              }
              return prevIndex + 1;
            });
            return 0; // Reset animation progress
          }
          return Math.min(prev + increment, 1);
        });
        
        if (isPlaying) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, chartData.length]);

  useEffect(() => {
    loadReplayData();
  }, [loadReplayData]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    setCustomSpeed(''); // Clear custom speed when preset is selected
  };

  const handleCustomSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSpeed(event.target.value);
  };

  const applyCustomSpeed = () => {
    const speed = parseFloat(customSpeed);
    if (!isNaN(speed) && speed > 0 && speed <= 10) {
      setPlaybackSpeed(speed);
    }
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(event.target.value);
    setCurrentIndex(newIndex);
    setAnimationProgress(0); // Reset animation progress when scrubbing
    setIsPlaying(false);
  };

  const skipToLap = (lapNumber: number) => {
    const targetFrame = chartData.findIndex(frame => frame.lapNumber >= lapNumber);
    if (targetFrame !== -1) {
      setCurrentIndex(targetFrame);
      setAnimationProgress(0);
      setIsPlaying(false);
    }
  };

  const getCurrentRaceStats = () => {
    if (!chartData[currentIndex]) return null;
    
    const frame = chartData[currentIndex];
    const leader = frame.positions[0];
    const totalPitStops = frame.positions.reduce((sum, p) => sum + p.pit_stops, 0);
    const driversInPit = frame.positions.filter(p => p.is_in_pit).length;
    
    return { leader, totalPitStops, driversInPit, flagCount: frame.flags.length };
  };

  const getPositionColour = (position: number): string => {
    if (position === 1) return 'text-yellow-400';
    if (position === 2) return 'text-gray-300';
    if (position === 3) return 'text-orange-400';
    if (position <= 10) return 'text-green-400';
    return 'text-white';
  };

  const formatLapTime = (duration: number | null): string => {
    if (!duration) return '--:--.---';
    const minutes = Math.floor(duration / 60);
    const seconds = (duration % 60).toFixed(3);
    return `${minutes}:${seconds.padStart(6, '0')}`;
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Please select a session to view race replay</p>
      </div>
    );
  }

  const raceStats = getCurrentRaceStats();

  return (
    <div className="space-y-6">
      {/* Header with F1 styling */}
      <div className="bg-gradient-to-r from-f1-red to-red-700 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Flag className="w-6 h-6" />
              Race Replay
            </h3>
            <p className="text-red-100">
              {session.session_name} • {session.location} • {session.year}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
            >
              <Flag className="w-4 h-4" />
              <span>Metrics</span>
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Race Statistics Panel */}
      {showMetrics && raceStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-f1-black rounded-lg p-4 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-400 text-sm">Leader</span>
            </div>
            <p className="text-white font-bold">{raceStats.leader?.name_acronym}</p>
          </div>
          
          <div className="bg-f1-black rounded-lg p-4 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <Wrench className="w-3 h-3 text-orange-500" />
              <span className="text-gray-400 text-sm">Total Pit Stops</span>
            </div>
            <p className="text-white font-bold">{raceStats.totalPitStops}</p>
          </div>
          
          <div className="bg-f1-black rounded-lg p-4 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-400 text-sm">In Pits</span>
            </div>
            <p className="text-white font-bold">{raceStats.driversInPit}</p>
          </div>
          
          <div className="bg-f1-black rounded-lg p-4 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <Flag className="w-3 h-3 text-yellow-500" />
              <span className="text-gray-400 text-sm">Active Flags</span>
            </div>
            <p className="text-white font-bold">{raceStats.flagCount}</p>
          </div>
        </div>
      )}

      {/* Enhanced Speed Controls */}
      {showSettings && (
        <div className="bg-f1-black rounded-lg p-6 border border-gray-700">
          <h4 className="text-white font-semibold mb-4">Playback Controls</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-3">Playback Speed</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {speedOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSpeedChange(option.value)}
                      className={`flex flex-col items-center space-y-1 px-3 py-3 rounded-lg text-sm transition-all duration-200 ${
                        playbackSpeed === option.value && customSpeed === ''
                          ? 'bg-f1-red text-white shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Custom Speed:</label>
                <input
                  type="number"
                  min="0.01"
                  max="10"
                  step="0.01"
                  value={customSpeed}
                  onChange={handleCustomSpeedChange}
                  placeholder="e.g. 0.75"
                  className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 w-20 text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && applyCustomSpeed()}
                />
                <button
                  onClick={applyCustomSpeed}
                  className="px-3 py-1 bg-f1-red hover:bg-red-700 text-white rounded text-sm transition-colors"
                >
                  Apply
                </button>
                <span className="text-xs text-gray-400">(0.01-10x)</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-300 mb-3">Quick Navigation</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => skipToLap(1)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  Start
                </button>
                <button
                  onClick={() => skipToLap(Math.floor(chartData[currentIndex]?.totalLaps / 4) || 1)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  25%
                </button>
                <button
                  onClick={() => skipToLap(Math.floor(chartData[currentIndex]?.totalLaps / 2) || 1)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => skipToLap(Math.floor((chartData[currentIndex]?.totalLaps * 3) / 4) || 1)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  75%
                </button>
                <button
                  onClick={() => skipToLap(chartData[currentIndex]?.totalLaps || 1)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  Finish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Loading race data...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadReplayData}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <>
          {/* Main Race Timing Board */}
          <div className="bg-f1-black rounded-lg overflow-hidden border border-gray-700 shadow-xl">
            <div className="bg-f1-red p-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                <h2 className="text-xl font-bold">Race Replay - Live Timing</h2>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <div className="relative">
                <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Pos</th>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-left">Progress</th>
                    <th className="px-4 py-3 text-left">Last Lap</th>
                    <th className="px-4 py-3 text-left">Lap</th>
                    <th className="px-4 py-3 text-left">S1</th>
                    <th className="px-4 py-3 text-left">S2</th>
                    <th className="px-4 py-3 text-left">S3</th>
                    <th className="px-4 py-3 text-left">Pits</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData[currentIndex] && (() => {
                    const interpolatedPositions = interpolateDriverPositions(
                      currentIndex > 0 ? chartData[currentIndex - 1] : null,
                      chartData[currentIndex],
                      animationProgress
                    );
                    
                    // Sort drivers by current position for proper table order
                    const sortedDrivers = interpolatedPositions.sort((a, b) => a.position - b.position);

                    return sortedDrivers.map((driver, index) => {
                      const positionChange = driver.position_change || 0;
                      
                      return (
                        <tr 
                          key={driver.driver_number} 
                          className={`border-b border-gray-700 hover:bg-gray-800 transition-all duration-500 ease-in-out ${
                            index % 2 === 0 ? 'bg-gray-900' : 'bg-f1-black'
                          } ${
                            positionChange < 0 ? 'ring-2 ring-green-400/50 bg-green-900/30' : 
                            positionChange > 0 ? 'ring-2 ring-red-400/50 bg-red-900/30' : ''
                          }`}
                        >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-lg ${getPositionColour(driver.position)}`}>
                              {driver.position}
                            </span>
                            {positionChange !== 0 && (
                              <div className={`flex items-center text-xs font-bold ${
                                positionChange < 0 ? 'text-green-300' : 'text-red-300'
                              }`}>
                                {positionChange < 0 ? (
                                  <TrendingUp className="w-4 h-4" />
                                ) : (
                                  <TrendingDown className="w-4 h-4" />
                                )}
                                <span className="ml-1">{Math.abs(positionChange)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`w-4 h-8 rounded transition-all duration-300 ${
                                positionChange !== 0 ? 'shadow-lg' : ''
                              }`}
                              style={{ 
                                backgroundColor: driver.team_colour,
                                boxShadow: positionChange !== 0 ? `0 0 8px ${driver.team_colour}80` : 'none'
                              }}
                            ></div>
                            <div>
                              <div className={`font-semibold transition-all duration-300 ${
                                positionChange < 0 ? 'text-green-300 font-bold' : 
                                positionChange > 0 ? 'text-red-300 font-bold' : ''
                              }`}>
                                {driver.name_acronym}
                              </div>
                              <div className="text-sm text-gray-400">{driver.driver_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{driver.full_name.split(' ')[0]}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`w-32 h-4 bg-gray-700 rounded relative overflow-hidden ${
                            positionChange !== 0 ? 'ring-1 ring-opacity-50' : ''
                          } ${
                            positionChange < 0 ? 'ring-green-400' : 
                            positionChange > 0 ? 'ring-red-400' : ''
                          }`}>
                            {/* Progress bar background */}
                            <div 
                              className={`h-full rounded transition-all duration-500 ease-out ${
                                positionChange !== 0 ? 'shadow-lg' : ''
                              }`}
                              style={{ 
                                backgroundColor: driver.team_colour,
                                width: `${Math.max(driver.progress * 100, 2)}%`
                              }}
                            ></div>
                            {/* Driver marker */}
                            {driver.is_in_pit ? (
                              <div 
                                className="absolute top-0 h-full w-12 bg-orange-500 flex items-center justify-center text-xs font-bold text-white transition-all duration-500 ease-out animate-pulse"
                                style={{ left: `${Math.max(driver.progress * 100 - 6, 0)}%` }}
                              >
                                PIT
                              </div>
                            ) : (
                              <div 
                                className="absolute top-0 h-full w-10 flex items-center justify-center text-xs font-bold text-white transition-all duration-500 ease-out"
                                style={{ 
                                  left: `${Math.max(driver.progress * 100 - 5, 0)}%`,
                                  backgroundColor: driver.team_colour,
                                  border: '2px solid white'
                                }}
                              >
                                {driver.name_acronym}
                              </div>
                            )}
                            {/* Progress percentage */}
                            <div className="absolute right-1 top-0 h-full flex items-center text-xs text-gray-300">
                              {(driver.progress * 100).toFixed(1)}%
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm">
                              {formatLapTime(driver.last_lap_time)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Flag className="w-4 h-4 text-gray-400" />
                            <span>{driver.current_lap_number || '--'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {formatLapTime(driver.sector_1_time)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {formatLapTime(driver.sector_2_time)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {formatLapTime(driver.sector_3_time)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {driver.pit_stops > 0 && (
                            <div className="flex items-center gap-1">
                              <Wrench className="w-4 h-4 text-orange-500" />
                              <span className="text-orange-500 font-semibold">{driver.pit_stops}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                    });
                  })()}
                </tbody>
                </table>
              </div>
            </div>

            {/* Race Flags */}
            {chartData[currentIndex] && chartData[currentIndex].flags.length > 0 && (
              <div className="bg-yellow-500 text-black p-3 font-bold text-center flex items-center justify-center gap-2">
                <Flag className="w-5 h-5" />
                {chartData[currentIndex].flags[0].message}
              </div>
            )}
          </div>

          {/* Enhanced Playback Controls */}
          <div className="bg-f1-black rounded-lg p-6 border border-gray-700">
            <div className="flex flex-col space-y-6">
              {/* Primary Controls */}
              <div className="flex items-center justify-center space-x-6">
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-all duration-200 hover:scale-105"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="font-medium">Reset</span>
                </button>

                <button
                  onClick={handlePlayPause}
                  className="flex items-center space-x-3 px-8 py-4 bg-f1-red hover:bg-red-700 rounded-lg text-white transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  <span className="font-bold text-lg">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800 rounded-lg">
                  <span className="text-gray-400 text-sm">Speed:</span>
                  <span className="text-white font-bold">{playbackSpeed}x</span>
                </div>
              </div>

              {/* Timeline Controls */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <div className="text-gray-400">
                    <span>Frame {currentIndex + 1} of {chartData.length}</span>
                  </div>
                  <div className="text-white font-medium">
                    {chartData[currentIndex] && 
                      `Lap ${chartData[currentIndex].lapNumber} of ${chartData[currentIndex].totalLaps} • ${new Date(chartData[currentIndex].timestamp).toLocaleTimeString()}`
                    }
                  </div>
                </div>
                
                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={chartData.length - 1}
                    value={currentIndex}
                    onChange={handleSliderChange}
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                    style={{
                      background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(currentIndex / (chartData.length - 1)) * 100}%, #374151 ${(currentIndex / (chartData.length - 1)) * 100}%, #374151 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Start</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>Finish</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Legend */}
          <div className="bg-f1-black rounded-lg p-6 border border-gray-700">
            <h4 className="text-white font-bold text-lg mb-4 flex items-center space-x-2">
              <Flag className="w-5 h-5 text-f1-red" />
              <span>Chart Guide</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-3">
                <h5 className="text-f1-red font-semibold">Position Layout</h5>
                <p className="text-gray-300"><strong>Vertical:</strong> Race position (P1 at top)</p>
                <p className="text-gray-300"><strong>Horizontal:</strong> Race progress (START → FINISH)</p>
              </div>
              <div className="space-y-3">
                <h5 className="text-f1-red font-semibold">Visual Elements</h5>
                <p className="text-gray-300"><strong>Coloured Bars:</strong> Team progress through race</p>
                <p className="text-gray-300"><strong>Orange Box:</strong> Driver in pit lane</p>
              </div>
              <div className="space-y-3">
                <h5 className="text-f1-red font-semibold">Race Events</h5>
                <p className="text-gray-300"><strong>Vertical Movement:</strong> Overtakes/position changes</p>
                <p className="text-gray-300"><strong>Yellow Banner:</strong> Race control flags</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RaceReplay;
