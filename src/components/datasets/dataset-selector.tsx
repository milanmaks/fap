"use client";

import React, { useState } from "react";
import { Dataset } from "@/lib/domain/types";
import { Database, Plus, ChevronDown, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

interface DatasetSelectorProps {
  datasets: Dataset[];
  currentDatasetId?: string;
  onSelectDataset: (id: string) => void;
  onCreateDataset: (name: string, description?: string) => Promise<void>;
  onDeleteDataset?: (id: string) => Promise<void>;
}

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  datasets,
  currentDatasetId,
  onSelectDataset,
  onCreateDataset,
  onDeleteDataset,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      await onCreateDataset(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentDatasetId || !onDeleteDataset || deleting) return;
    setDeleting(true);
    try {
      await onDeleteDataset(currentDatasetId);
      setShowDeleteModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const currentDataset = datasets.find((d) => d.id === currentDatasetId);

  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <select
          value={currentDatasetId || ""}
          onChange={(e) => onSelectDataset(e.target.value)}
          className="appearance-none bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium py-2 pl-9 pr-8 rounded-lg shadow-xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Database className="w-4 h-4 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        className="gap-1 text-xs"
        title="Kreiraj novi dataset"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Novi</span>
      </Button>

      {currentDataset && onDeleteDataset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
          className="text-slate-400 hover:text-rose-600 p-2"
          title="Obriši trenutni dataset"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      {/* Modal dialog for creating new dataset */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Kreirajte novi dataset
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Definišite naziv i opcioni opis za novi skup podataka.
            </p>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Naziv dataset-a *
                </label>
                <input
                  type="text"
                  required
                  placeholder="npr. Finansijske transakcije Q1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Opis (opciono)
                </label>
                <textarea
                  placeholder="Opis izvora podataka ili svrhe analize..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Otkaži
                </Button>
                <Button type="submit" size="sm" disabled={loading || !name.trim()}>
                  {loading ? "Kreiranje..." : "Kreiraj"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation modal for deleting dataset */}
      {showDeleteModal && currentDataset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center space-x-3 mb-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Brisanje dataset-a
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Da li ste sigurni da želite da trajno obrišete dataset{" "}
              <strong className="text-slate-900 font-semibold">{currentDataset.name}</strong> i sve njegove
              verzije, uvezene fajlove i istoriju razgovora?
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Otkaži
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Brisanje..." : "Obriši Dataset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
