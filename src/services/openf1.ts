import {
  Driver,
  CarData,
  Position,
  Lap,
  Weather,
  Session,
  RaceControl,
  TeamRadio,
  LocationData,
  RaceReplayData,
  ChampionshipData,
  DriverStanding,
  ConstructorStanding
} from '../types/f1';

const BASE_URL = 'https://api.openf1.org/v1';

export class OpenF1Service {
  private async fetchData<T>(endpoint: string, params: Record<string, any> = {}): Promise<T[]> {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async getDrivers(sessionKey?: number | string, driverNumber?: number): Promise<Driver[]> {
    return this.fetchData<Driver>('drivers', {
      session_key: sessionKey,
      driver_number: driverNumber
    });
  }

  async getCarData(
    sessionKey?: number | string,
    driverNumber?: number,
    speedMin?: number,
    limit?: number
  ): Promise<CarData[]> {
    const params: Record<string, any> = {
      session_key: sessionKey,
      driver_number: driverNumber
    };
    
    if (speedMin) {
      params['speed>='] = speedMin;
    }
    
    return this.fetchData<CarData>('car_data', params);
  }

  async getPositions(
    sessionKey?: number | string,
    driverNumber?: number,
    position?: number
  ): Promise<Position[]> {
    return this.fetchData<Position>('position', {
      session_key: sessionKey,
      driver_number: driverNumber,
      position
    });
  }

  async getLocationData(
    sessionKey?: number | string,
    driverNumber?: number,
    dateAfter?: string,
    dateBefore?: string
  ): Promise<LocationData[]> {
    return this.fetchData<LocationData>('location', {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>': dateAfter,
      'date<': dateBefore
    });
  }

  async getRaceReplayData(sessionKey: number | string, startTime?: string, endTime?: string): Promise<RaceReplayData[]> {
    try {
      const [drivers, locations, positions] = await Promise.all([
        this.getDrivers(sessionKey),
        this.getLocationData(sessionKey, undefined, startTime, endTime),
        this.getPositions(sessionKey)
      ]);

      // Create a map of driver info
      const driverMap = new Map(drivers.map(d => [d.driver_number, d]));
      
      // Group location data by timestamp
      const timeGroups = new Map<string, LocationData[]>();
      locations.forEach(location => {
        const timeKey = location.date;
        if (!timeGroups.has(timeKey)) {
          timeGroups.set(timeKey, []);
        }
        timeGroups.get(timeKey)!.push(location);
      });

      // Convert to replay data format
      const replayData: RaceReplayData[] = [];
      timeGroups.forEach((locationGroup, timestamp) => {
        const driversAtTime = locationGroup.map(location => {
          const driver = driverMap.get(location.driver_number);
          const position = positions.find(p => 
            p.driver_number === location.driver_number && 
            Math.abs(new Date(p.date).getTime() - new Date(location.date).getTime()) < 5000
          );

          return {
            driver_number: location.driver_number,
            x: location.x,
            y: location.y,
            position: position?.position || 0,
            team_colour: driver?.team_colour || '#ffffff',
            name_acronym: driver?.name_acronym || `D${location.driver_number}`
          };
        });

        replayData.push({
          timestamp,
          drivers: driversAtTime
        });
      });

      return replayData.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      console.error('Error fetching race replay data:', error);
      throw error;
    }
  }

  async getLaps(
    sessionKey?: number | string,
    driverNumber?: number,
    lapNumber?: number
  ): Promise<Lap[]> {
    return this.fetchData<Lap>('laps', {
      session_key: sessionKey,
      driver_number: driverNumber,
      lap_number: lapNumber
    });
  }

  async getWeather(
    sessionKey?: number | string,
    meetingKey?: number | string
  ): Promise<Weather[]> {
    return this.fetchData<Weather>('weather', {
      session_key: sessionKey,
      meeting_key: meetingKey
    });
  }

  async getSessions(
    year?: number,
    meetingKey?: number | string,
    sessionName?: string
  ): Promise<Session[]> {
    return this.fetchData<Session>('sessions', {
      year,
      meeting_key: meetingKey,
      session_name: sessionName
    });
  }

  async getRaceControl(
    sessionKey?: number | string,
    category?: string,
    flag?: string
  ): Promise<RaceControl[]> {
    return this.fetchData<RaceControl>('race_control', {
      session_key: sessionKey,
      category,
      flag
    });
  }

  async getTeamRadio(
    sessionKey?: number | string,
    driverNumber?: number
  ): Promise<TeamRadio[]> {
    return this.fetchData<TeamRadio>('team_radio', {
      session_key: sessionKey,
      driver_number: driverNumber
    });
  }

  async getLatestSession(): Promise<Session | null> {
    try {
      const sessions = await this.fetchData<Session>('sessions', {
        session_key: 'latest'
      });
      return sessions.length > 0 ? sessions[0] : null;
    } catch (error) {
      console.error('Error fetching latest session:', error);
      return null;
    }
  }

  async getCurrentRaceData(sessionKey: number | string) {
    try {
      const [drivers, positions, laps, weather, raceControl] = await Promise.all([
        this.getDrivers(sessionKey),
        this.getPositions(sessionKey),
        this.getLaps(sessionKey),
        this.getWeather(sessionKey),
        this.getRaceControl(sessionKey)
      ]);

      return {
        drivers,
        positions,
        laps,
        weather: weather.length > 0 ? weather[weather.length - 1] : null,
        raceControl: raceControl.slice(-10) // Last 10 messages
      };
    } catch (error) {
      console.error('Error fetching current race data:', error);
      throw error;
    }
  }

  async getMeetings(year?: number): Promise<{ meeting_key: number; location: string; circuit_short_name: string; country_name: string }[]> {
    const sessions = await this.fetchData<Session>('sessions', { year });
    
    // Group by meeting_key to get unique meetings
    const meetingsMap = new Map();
    sessions.forEach(session => {
      if (!meetingsMap.has(session.meeting_key)) {
        meetingsMap.set(session.meeting_key, {
          meeting_key: session.meeting_key,
          location: session.location,
          circuit_short_name: session.circuit_short_name,
          country_name: session.country_name
        });
      }
    });
    
    return Array.from(meetingsMap.values());
  }

  async getChampionshipStandings(year: number = 2024): Promise<ChampionshipData> {
    try {
      // Get all sessions for the year
      const sessions = await this.getSessions(year);
      
      // Filter for race sessions only
      const raceSessions = sessions.filter(session => 
        session.session_name.toLowerCase().includes('race') && 
        !session.session_name.toLowerCase().includes('sprint')
      );

      // F1 points system
      const pointsSystem = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
      
      const driverStats = new Map<number, {
        driver: Driver;
        points: number;
        wins: number;
        podiums: number;
      }>();
      
      const constructorStats = new Map<string, {
        team_name: string;
        team_colour: string;
        points: number;
        wins: number;
        podiums: number;
        drivers: Set<number>;
      }>();

      // Process each race session
      for (const raceSession of raceSessions) {
        try {
          const [drivers, positions] = await Promise.all([
            this.getDrivers(raceSession.session_key),
            this.getPositions(raceSession.session_key)
          ]);

          // Get final race positions (latest position for each driver)
          const finalPositions = new Map<number, number>();
          positions.forEach(pos => {
            const existing = finalPositions.get(pos.driver_number);
            if (!existing || new Date(pos.date) > new Date(positions.find(p => p.driver_number === pos.driver_number && p.position === existing)?.date || '')) {
              finalPositions.set(pos.driver_number, pos.position);
            }
          });

          // Award points based on final positions
          finalPositions.forEach((position, driverNumber) => {
            const driver = drivers.find(d => d.driver_number === driverNumber);
            if (!driver) return;

            const points = position <= pointsSystem.length ? pointsSystem[position - 1] : 0;
            const isWin = position === 1;
            const isPodium = position <= 3;

            // Update driver stats
            if (!driverStats.has(driverNumber)) {
              driverStats.set(driverNumber, {
                driver,
                points: 0,
                wins: 0,
                podiums: 0
              });
            }
            
            const driverStat = driverStats.get(driverNumber)!;
            driverStat.points += points;
            if (isWin) driverStat.wins++;
            if (isPodium) driverStat.podiums++;

            // Update constructor stats
            if (!constructorStats.has(driver.team_name)) {
              constructorStats.set(driver.team_name, {
                team_name: driver.team_name,
                team_colour: driver.team_colour,
                points: 0,
                wins: 0,
                podiums: 0,
                drivers: new Set()
              });
            }
            
            const constructorStat = constructorStats.get(driver.team_name)!;
            constructorStat.points += points;
            constructorStat.drivers.add(driverNumber);
            if (isWin) constructorStat.wins++;
            if (isPodium) constructorStat.podiums++;
          });
        } catch (error) {
          console.warn(`Error processing race session ${raceSession.session_key}:`, error);
        }
      }

      // Convert to standings format
      const driverStandings: DriverStanding[] = Array.from(driverStats.entries())
        .map(([driverNumber, stats]) => ({
          position: 0, // Will be set after sorting
          driver_number: driverNumber,
          name_acronym: stats.driver.name_acronym,
          full_name: stats.driver.full_name,
          team_name: stats.driver.team_name,
          team_colour: stats.driver.team_colour,
          points: stats.points,
          wins: stats.wins,
          podiums: stats.podiums
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.podiums - a.podiums;
        })
        .map((driver, index) => ({ ...driver, position: index + 1 }));

      const constructorStandings: ConstructorStanding[] = Array.from(constructorStats.entries())
        .map(([teamName, stats]) => ({
          position: 0, // Will be set after sorting
          team_name: teamName,
          team_colour: stats.team_colour,
          points: stats.points,
          wins: stats.wins,
          podiums: stats.podiums,
          drivers: Array.from(stats.drivers).map(driverNumber => {
            const driverStat = driverStats.get(driverNumber);
            return {
              driver_number: driverNumber,
              name_acronym: driverStat?.driver.name_acronym || `D${driverNumber}`,
              points: driverStat?.points || 0
            };
          })
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.podiums - a.podiums;
        })
        .map((constructor, index) => ({ ...constructor, position: index + 1 }));

      return {
        drivers: driverStandings,
        constructors: constructorStandings,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error calculating championship standings:', error);
      throw error;
    }
  }
}

export const openF1Service = new OpenF1Service();
