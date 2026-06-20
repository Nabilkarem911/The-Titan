import React from 'react';
import { Link } from 'react-router-dom';
import TitanLogo from '../components/TitanLogo';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-deep flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 start-1/4 w-72 h-72 bg-violet/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 end-1/4 w-72 h-72 bg-cyan/5 rounded-full blur-[100px]" />
      </div>
      <div className="relative text-center">
        <TitanLogo size={48} className="mx-auto mb-6" />
        <h1 className="font-heading text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan to-violet mb-4">
          404
        </h1>
        <p className="text-text-secondary text-lg mb-6">
          This page does not exist in the Titan network.
        </p>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
