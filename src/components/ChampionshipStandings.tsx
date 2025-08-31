import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Crown, Medal, Award, ChevronDown, ChevronUp, Users, Car } from 'lucide-react';
import { openF1Service } from '../services/openf1';
import { ChampionshipData, DriverStanding, ConstructorStanding } from '../types/f1';

interface ChampionshipStandingsProps {
  year?: number;
}

const ChampionshipStandings: React.FC<ChampionshipStandingsProps> = ({ year = 2025 }) => {
  const [championshipData, setChampionshipData] = useState<ChampionshipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDrivers, setShowFullDrivers] = useState(false);
  const [showFullConstructors, setShowFullConstructors] = useState(false);
  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers');

  const loadChampionshipData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await openF1Service.getChampionshipStandings(year);
      setChampionshipData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load championship data');
      console.error('Error loading championship data:', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadChampionshipData();
  }, [loadChampionshipData]);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-400" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold">{position}</span>;
    }
  };

  const getPositionColour = (position: number): string => {
    if (position === 1) return 'text-yellow-400';
    if (position === 2) return 'text-gray-300';
    if (position === 3) return 'text-orange-400';
    if (position <= 10) return 'text-green-400';
    return 'text-white';
  };

  const DriverRow: React.FC<{ driver: DriverStanding; index: number }> = ({ driver, index }) => (
    <tr 
      className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${
        index % 2 === 0 ? 'bg-gray-900' : 'bg-f1-black'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getPositionIcon(driver.position)}
          <span className={`font-bold text-lg ${getPositionColour(driver.position)}`}>
            {driver.position}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-8 rounded"
            style={{ backgroundColor: driver.team_colour }}
          ></div>
          <div>
            <div className="font-semibold text-white">{driver.name_acronym}</div>
            <div className="text-sm text-gray-400">{driver.driver_number}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-gray-300">{driver.full_name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-gray-300">{driver.team_name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-bold text-lg text-white">{driver.points}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-yellow-400">{driver.wins}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-orange-400">{driver.podiums}</span>
      </td>
    </tr>
  );

  const ConstructorRow: React.FC<{ constructorData: ConstructorStanding; index: number }> = ({ constructorData, index }) => (
    <tr 
      className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${
        index % 2 === 0 ? 'bg-gray-900' : 'bg-f1-black'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getPositionIcon(constructorData.position)}
          <span className={`font-bold text-lg ${getPositionColour(constructorData.position)}`}>
            {constructorData.position}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-8 rounded"
            style={{ backgroundColor: constructorData.team_colour }}
          ></div>
          <div>
            <div className="font-semibold text-white">{constructorData.team_name}</div>
            <div className="text-sm text-gray-400">
              {constructorData.drivers.map(d => d.name_acronym).join(', ')}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-bold text-lg text-white">{constructorData.points}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-yellow-400">{constructorData.wins}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-orange-400">{constructorData.podiums}</span>
      </td>
    </tr>
  );

  if (!championshipData && loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-f1-red to-red-700 rounded-lg p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Championship Standings {year}
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>Loading championship standings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-f1-red to-red-700 rounded-lg p-6 shadow-lg">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Championship Standings {year}
          </h3>
        </div>
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadChampionshipData}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!championshipData) return null;

  const displayedDrivers = showFullDrivers ? championshipData.drivers : championshipData.drivers.slice(0, 5);
  const displayedConstructors = showFullConstructors ? championshipData.constructors : championshipData.constructors.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-f1-red to-red-700 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Championship Standings {year}
          </h3>
          <div className="text-sm text-red-100">
            Last updated: {new Date(championshipData.last_updated).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('drivers')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'drivers'
              ? 'bg-f1-red text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Drivers Championship</span>
        </button>
        <button
          onClick={() => setActiveTab('constructors')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'constructors'
              ? 'bg-f1-red text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Constructors Championship</span>
        </button>
      </div>

      {/* Drivers Championship */}
      {activeTab === 'drivers' && (
        <div className="bg-f1-black rounded-lg overflow-hidden border border-gray-700 shadow-xl">
          <div className="bg-f1-red p-4">
            <h4 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Drivers Championship
            </h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">Pos</th>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Full Name</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Points</th>
                  <th className="px-4 py-3 text-left">Wins</th>
                  <th className="px-4 py-3 text-left">Podiums</th>
                </tr>
              </thead>
              <tbody>
                {displayedDrivers.map((driver, index) => (
                  <DriverRow key={driver.driver_number} driver={driver} index={index} />
                ))}
              </tbody>
            </table>
          </div>

          {championshipData.drivers.length > 5 && (
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowFullDrivers(!showFullDrivers)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors w-full justify-center"
              >
                {showFullDrivers ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Show Top 5</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show All Drivers ({championshipData.drivers.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Constructors Championship */}
      {activeTab === 'constructors' && (
        <div className="bg-f1-black rounded-lg overflow-hidden border border-gray-700 shadow-xl">
          <div className="bg-f1-red p-4">
            <h4 className="text-xl font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5" />
              Constructors Championship
            </h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left">Pos</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Points</th>
                  <th className="px-4 py-3 text-left">Wins</th>
                  <th className="px-4 py-3 text-left">Podiums</th>
                </tr>
              </thead>
              <tbody>
                {displayedConstructors.map((constructorData, index) => (
                  <ConstructorRow key={constructorData.team_name} constructorData={constructorData} index={index} />
                ))}
              </tbody>
            </table>
          </div>

          {championshipData.constructors.length > 5 && (
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowFullConstructors(!showFullConstructors)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors w-full justify-center"
              >
                {showFullConstructors ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Show Top 5</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show All Teams ({championshipData.constructors.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChampionshipStandings;
