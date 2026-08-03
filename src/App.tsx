import React, { useEffect, useState } from 'react';
import { UserLocation } from './types';
import { getCurrentGpsPosition } from './services/geocoding';
import { loadPersistedState, savePersistedState } from './services/persistence';
import { Navbar } from './components/Navbar';
import { LocationModal } from './components/LocationModal';
import { TabAnnualMaxAltitude } from './components/TabAnnualMaxAltitude';
import { TabTwentyYearEphemeris } from './components/TabTwentyYearEphemeris';
import { TabSaturnRings } from './components/TabSaturnRings';
import { TabLunarLibration } from './components/TabLunarLibration';
import { TabEclipses } from './components/TabEclipses';
import { TabAstroGuide } from './components/TabAstroGuide';
import { TabFilterGuides } from './components/TabFilterGuides';

export default function App() {
  // Initial location/year/tab restored from localStorage (fallback: Roma, Italia)
  const [location, setLocation] = useState<UserLocation>(() => loadPersistedState().location);
  const [selectedYear, setSelectedYear] = useState<number>(() => loadPersistedState().selectedYear);
  const [activeTab, setActiveTab] = useState<string>(() => loadPersistedState().activeTab);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);

  useEffect(() => {
    savePersistedState({ location, selectedYear, activeTab });
  }, [location, selectedYear, activeTab]);

  const handleQuickGps = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentGpsPosition();
      setLocation(pos);
    } catch (err: any) {
      alert(err.message || 'Errore durante la geolocalizzazione GPS dal browser.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        location={location}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onQuickGps={handleQuickGps}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isGpsLoading={isGpsLoading}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'annual' && (
          <TabAnnualMaxAltitude
            location={location}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
          />
        )}

        {activeTab === 'ephemeris20' && (
          <TabTwentyYearEphemeris location={location} />
        )}

        {activeTab === 'saturn' && (
          <TabSaturnRings location={location} />
        )}

        {activeTab === 'libration' && (
          <TabLunarLibration location={location} selectedYear={selectedYear} />
        )}

        {activeTab === 'eclipses' && (
          <TabEclipses location={location} />
        )}

        {activeTab === 'guideVisual' && (
          <TabAstroGuide location={location} selectedYear={selectedYear} section="visual" />
        )}

        {activeTab === 'guideImaging' && (
          <TabAstroGuide location={location} selectedYear={selectedYear} section="imaging" />
        )}

        {activeTab === 'filtersVisual' && <TabFilterGuides section="visual" />}

        {activeTab === 'filtersImaging' && <TabFilterGuides section="imaging" />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Apex (AstroCal) - Astronomical Planning & EXploration
          </div>
          <div className="text-[11px] text-slate-600">
            Coordinate attive: {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
          </div>
        </div>
      </footer>

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectLocation={(loc) => setLocation(loc)}
        currentLocation={location}
      />
    </div>
  );
}
