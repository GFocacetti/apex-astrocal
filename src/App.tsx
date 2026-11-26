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
import { TabSimulatorEyepiece } from './components/TabSimulatorEyepiece';
import { TabSimulatorSeeingAdc } from './components/TabSimulatorSeeingAdc';
import { TabSimulatorFieldRotation } from './components/TabSimulatorFieldRotation';
import { TabSimulatorSnrStacking } from './components/TabSimulatorSnrStacking';
import { TabSimulatorBahtinov } from './components/TabSimulatorBahtinov';
import { TabSimulatorLrgbOsc } from './components/TabSimulatorLrgbOsc';
import { TabSimulatorCollimation } from './components/TabSimulatorCollimation';
import { TabSimulatorBackfocus } from './components/TabSimulatorBackfocus';
import { TabSimulatorPolarAlign } from './components/TabSimulatorPolarAlign';
import { TabSimulatorGuiding } from './components/TabSimulatorGuiding';

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
    <div className="min-h-screen flex flex-col bg-ink text-neutral-200 font-sans">
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-10 pb-20">
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

        {activeTab === 'simEyepiece' && <TabSimulatorEyepiece />}

        {activeTab === 'simSeeingAdc' && <TabSimulatorSeeingAdc />}

        {activeTab === 'simFieldRotation' && <TabSimulatorFieldRotation location={location} />}

        {activeTab === 'simSnrStacking' && <TabSimulatorSnrStacking />}

        {activeTab === 'simBahtinov' && <TabSimulatorBahtinov />}

        {activeTab === 'simLrgbOsc' && <TabSimulatorLrgbOsc />}

        {activeTab === 'simCollimation' && <TabSimulatorCollimation />}

        {activeTab === 'simBackfocus' && <TabSimulatorBackfocus />}

        {activeTab === 'simPolarAlign' && <TabSimulatorPolarAlign location={location} />}

        {activeTab === 'simGuiding' && <TabSimulatorGuiding />}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-600">
          <span className="font-display uppercase tracking-[0.2em]">Astronomical Planning &amp; Exploration</span>
          <span className="tabular">
            {location.name} · {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
          </span>
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
