import React, { useState, useEffect } from 'react';
import { Driver } from '../types/f1';
import { openF1Service } from '../services/openf1';
import { Users, Check } from 'lucide-react';

interface DriverSelectorProps {
  sessionKey: number | string;
  selectedDrivers: number[];
  onDriverSelection: (driverNumbers: number[]) => void;
}

export const DriverSelector: React.FC<DriverSelectorProps> = ({
  sessionKey,
  selectedDrivers,
  onDriverSelection
}) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const driversData = await openF1Service.getDrivers(sessionKey);
        setDrivers(driversData);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
  }, [sessionKey]);

  const toggleDriver = (driverNumber: number) => {
    const isSelected = selectedDrivers.includes(driverNumber);
    if (isSelected) {
      onDriverSelection(selectedDrivers.filter(num => num !== driverNumber));
    } else {
      onDriverSelection([...selectedDrivers, driverNumber]);
    }
  };

  const selectAll = () => {
    onDriverSelection(drivers.map(driver => driver.driver_number));
  };

  const clearAll = () => {
    onDriverSelection([]);
  };

  if (loading) {
    return (
      <div className="bg-f1-black rounded-lg p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-gray-700 rounded w-32"></div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-f1-black rounded-lg overflow-hidden">
      <div className="bg-gray-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h3 className="font-bold">Select Drivers</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 bg-f1-red text-white rounded hover:bg-red-700"
            >
              All
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
          {drivers.map((driver) => {
            const isSelected = selectedDrivers.includes(driver.driver_number);
            return (
              <button
                key={driver.driver_number}
                onClick={() => toggleDriver(driver.driver_number)}
                className={`p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-f1-red bg-f1-red/20'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-5 sm:w-3 sm:h-6 rounded flex-shrink-0"
                    style={{ backgroundColor: `#${driver.team_colour}` }}
                  ></div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm truncate">{driver.name_acronym}</span>
                      {isSelected && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-f1-red flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-400">#{driver.driver_number}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {selectedDrivers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Selected: {selectedDrivers.length} driver{selectedDrivers.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

