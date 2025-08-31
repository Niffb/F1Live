import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { CarData, Driver } from '../types/f1';
import { openF1Service } from '../services/openf1';
import { Activity, Gauge, Zap } from 'lucide-react';

interface TelemetryChartProps {
  sessionKey: number | string;
  selectedDrivers: number[];
}

interface TelemetryDataPoint {
  time: string;
  timestamp: number;
  [key: string]: any; // For dynamic driver data
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ sessionKey, selectedDrivers }) => {
  const [telemetryData, setTelemetryData] = useState<TelemetryDataPoint[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'speed' | 'throttle' | 'rpm'>('speed');
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetryData = useCallback(async () => {
    try {
      setError(null);
      const [driversData, ...carDataArrays] = await Promise.all([
        openF1Service.getDrivers(sessionKey),
        ...selectedDrivers.map(driverNumber => 
          openF1Service.getCarData(sessionKey, driverNumber)
        )
      ]);

      setDrivers(driversData);

      const telemetryMap = new Map<string, TelemetryDataPoint>();

      carDataArrays.forEach((carDataArray, index) => {
        const driverNumber = selectedDrivers[index];
        const driver = driversData.find(d => d.driver_number === driverNumber);
        
        carDataArray.slice(-100).forEach((data: CarData) => { // Last 100 data points
          const timeKey = new Date(data.date).toISOString();
          
          if (!telemetryMap.has(timeKey)) {
            telemetryMap.set(timeKey, {
              time: new Date(data.date).toLocaleTimeString(),
              timestamp: new Date(data.date).getTime()
            });
          }
          
          const point = telemetryMap.get(timeKey)!;
          const driverKey = `${driver?.name_acronym || driverNumber}`;
          point[`${driverKey}_speed`] = data.speed;
          point[`${driverKey}_throttle`] = data.throttle;
          point[`${driverKey}_rpm`] = data.rpm;
          point[`${driverKey}_brake`] = data.brake;
          point[`${driverKey}_drs`] = data.drs >= 10 ? 1 : 0; // DRS active
        });
      });

      const sortedData = Array.from(telemetryMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      setTelemetryData(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry data');
    } finally {
      setLoading(false);
    }
  }, [sessionKey, selectedDrivers]);

  useEffect(() => {
    if (selectedDrivers.length > 0) {
      fetchTelemetryData();
      const interval = setInterval(fetchTelemetryData, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [fetchTelemetryData, selectedDrivers]);

  const getDriverColour = (driverNumber: number): string => {
    const driver = drivers.find(d => d.driver_number === driverNumber);
    return driver ? `#${driver.team_colour}` : '#FFFFFF';
  };

  const getMetricConfig = () => {
    switch (selectedMetric) {
      case 'speed':
        return {
          icon: <Gauge className="w-5 h-5" />,
          title: 'Speed (km/h)',
          yAxisDomain: [0, 350],
          suffix: '_speed'
        };
      case 'throttle':
        return {
          icon: <Zap className="w-5 h-5" />,
          title: 'Throttle (%)',
          yAxisDomain: [0, 100],
          suffix: '_throttle'
        };
      case 'rpm':
        return {
          icon: <Activity className="w-5 h-5" />,
          title: 'RPM',
          yAxisDomain: [8000, 12000],
          suffix: '_rpm'
        };
    }
  };

  const metricConfig = getMetricConfig();

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
          <p>Error loading telemetry data: {error}</p>
          <button 
            onClick={fetchTelemetryData}
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
      <div className="bg-f1-red p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2">
            {metricConfig.icon}
            <h2 className="text-lg sm:text-xl font-bold">Telemetry - {metricConfig.title}</h2>
          </div>
          <div className="flex gap-1 sm:gap-2 w-full sm:w-auto">
            {(['speed', 'throttle', 'rpm'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                  selectedMetric === metric
                    ? 'bg-white text-f1-red'
                    : 'bg-transparent text-white border border-white hover:bg-white hover:text-f1-red'
                }`}
              >
                {metric.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {telemetryData.length > 0 ? (
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={metricConfig.yAxisDomain}
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10 }}
                  width={60}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {selectedDrivers.map((driverNumber) => {
                  const driver = drivers.find(d => d.driver_number === driverNumber);
                  const driverKey = driver?.name_acronym || driverNumber.toString();
                  return (
                    <Line
                      key={driverNumber}
                      type="monotone"
                      dataKey={`${driverKey}${metricConfig.suffix}`}
                      stroke={getDriverColour(driverNumber)}
                      strokeWidth={2}
                      dot={false}
                      name={`${driverKey}`}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 sm:h-80 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Activity className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No telemetry data available</p>
              <p className="text-xs sm:text-sm">Select drivers to view their car data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
