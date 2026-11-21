"use client";

import React from "react";
import { ChibiTier } from "@/lib/chibiEvolution";

export type PixelChibiMood = "idle" | "happy" | "angry" | "party";

interface PixelChibiArtProps {
  mood?: PixelChibiMood;
  tierId?: ChibiTier["id"];
  className?: string;
}

/**
 * High-Detail 32x32 Pixel-Art Chibi Mascot (shapeRendering="crispEdges")
 * 4x pixel density compared to 16x16 for sharp outlines, multi-tone hair/hoodie shading,
 * sparkling anime eyes, expressive moods (idle, happy, angry, party), and 5 evolution accessories.
 */
export default function PixelChibiArt({
  mood = "idle",
  tierId,
  className = "h-36 w-36",
}: PixelChibiArtProps) {
  const showEvolutionHat = mood !== "party";

  return (
    <svg
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`Pixel Chibi 32x32 (${mood})`}
    >
      {/* ==================== TOP ACCESSORY / HAT ==================== */}
      {/* Party Mode: Festive Striped Party Cone Hat */}
      {mood === "party" && (
        <g>
          {/* Pom-pom */}
          <rect x="15" y="0" width="2" height="1" fill="#F5EFE6" />
          <rect x="14" y="1" width="4" height="1" fill="#F3C969" />
          {/* Cone outline & stripes */}
          <rect x="14" y="2" width="4" height="1" fill="#141413" />
          <rect x="13" y="3" width="6" height="1" fill="#FF8A8A" />
          <rect x="12" y="4" width="8" height="1" fill="#F3C969" />
          <rect x="11" y="5" width="10" height="1" fill="#C8B6FF" />
          <rect x="10" y="6" width="12" height="1" fill="#141413" />
        </g>
      )}

      {/* Evolution Tier 1: Sprout Leaf */}
      {showEvolutionHat && tierId === "sprout" && (
        <g>
          <rect x="15" y="2" width="2" height="4" fill="#141413" />
          <rect x="15" y="3" width="1" height="3" fill="#A7D7A9" />
          {/* Left leaf */}
          <rect x="11" y="1" width="4" height="1" fill="#141413" />
          <rect x="10" y="2" width="5" height="2" fill="#A7D7A9" />
          <rect x="11" y="2" width="2" height="1" fill="#d9f99d" />
          <rect x="11" y="4" width="4" height="1" fill="#141413" />
          {/* Right leaf */}
          <rect x="17" y="2" width="4" height="1" fill="#141413" />
          <rect x="17" y="3" width="5" height="2" fill="#6ee7b7" />
          <rect x="18" y="3" width="2" height="1" fill="#A7D7A9" />
          <rect x="17" y="5" width="4" height="1" fill="#141413" />
        </g>
      )}

      {/* Evolution Tier 3: Graduation Cap (Mortarboard) */}
      {showEvolutionHat && tierId === "scholar" && (
        <g>
          <rect x="9" y="1" width="14" height="1" fill="#141413" />
          <rect x="7" y="2" width="18" height="2" fill="#2A2823" />
          <rect x="9" y="2" width="14" height="1" fill="#C8B6FF" />
          <rect x="15" y="2" width="2" height="1" fill="#F3C969" />
          <rect x="10" y="4" width="12" height="2" fill="#141413" />
          <rect x="11" y="4" width="10" height="1" fill="#3A3832" />
          {/* Hanging gold tassel */}
          <rect x="24" y="3" width="1" height="4" fill="#F3C969" />
          <rect x="23" y="7" width="3" height="2" fill="#F3C969" />
          <rect x="24" y="7" width="1" height="2" fill="#fef08a" />
        </g>
      )}

      {/* Evolution Tier 5: Royal Diamond Crown */}
      {showEvolutionHat && tierId === "royal" && (
        <g>
          {/* Crown outline & tips */}
          <rect x="10" y="1" width="2" height="2" fill="#F3C969" />
          <rect x="15" y="0" width="2" height="3" fill="#F3C969" />
          <rect x="20" y="1" width="2" height="2" fill="#F3C969" />
          <rect x="10" y="3" width="12" height="3" fill="#F3C969" />
          <rect x="11" y="3" width="10" height="1" fill="#fef08a" />
          <rect x="10" y="5" width="12" height="1" fill="#d97706" />
          {/* Gems */}
          <rect x="15" y="3" width="2" height="2" fill="#B8D8F8" />
          <rect x="15" y="3" width="1" height="1" fill="#ffffff" />
          <rect x="11" y="4" width="1" height="1" fill="#FF8A8A" />
          <rect x="20" y="4" width="1" height="1" fill="#FF8A8A" />
        </g>
      )}

      {/* Angry Mode: Pixel Anger Vein Mark (Top Left) */}
      {mood === "angry" && (
        <g className="bm-anger-vein">
          <rect x="2" y="3" width="2" height="3" fill="#FF8A8A" />
          <rect x="4" y="5" width="1" height="1" fill="#FF8A8A" />
          <rect x="5" y="3" width="2" height="3" fill="#FF8A8A" />
          <rect x="2" y="7" width="2" height="1" fill="#f43f5e" />
          <rect x="5" y="7" width="2" height="1" fill="#f43f5e" />
        </g>
      )}

      {/* ==================== CAT-EAR HOODIE & HEAD ==================== */}
      {/* Left Cat Ear */}
      <rect x="6" y="4" width="4" height="1" fill="#141413" />
      <rect x="5" y="5" width="6" height="4" fill="#141413" />
      <rect x="6" y="5" width="4" height="3" fill="#312e81" />
      <rect x="7" y="6" width="2" height="2" fill="#f472b6" />

      {/* Right Cat Ear */}
      <rect x="22" y="4" width="4" height="1" fill="#141413" />
      <rect x="21" y="5" width="6" height="4" fill="#141413" />
      <rect x="22" y="5" width="4" height="3" fill="#312e81" />
      <rect x="23" y="6" width="2" height="2" fill="#f472b6" />

      {/* Outer Head / Hoodie Outline */}
      <rect x="8" y="6" width="16" height="1" fill="#141413" />
      <rect x="6" y="7" width="20" height="2" fill="#141413" />
      <rect x="5" y="9" width="22" height="9" fill="#141413" />
      <rect x="6" y="18" width="20" height="2" fill="#141413" />
      <rect x="8" y="20" width="16" height="1" fill="#141413" />

      {/* Hoodie Base & Multi-Tone Shading */}
      <rect x="8" y="7" width="16" height="12" fill="#3730a3" />
      <rect x="6" y="9" width="20" height="9" fill="#4338ca" />
      {/* Top Hoodie Highlight */}
      <rect x="9" y="7" width="14" height="2" fill="#6366f1" />
      <rect x="11" y="8" width="10" height="1" fill="#818cf8" />

      {/* ==================== FACE & HAIR BANGS ==================== */}
      {/* Warm Peach Face Skin */}
      <rect x="9" y="10" width="14" height="9" fill="#fde6d0" />
      <rect x="8" y="11" width="16" height="7" fill="#fde6d0" />
      {/* Subtle Forehead Shadow under bangs */}
      <rect x="9" y="10" width="14" height="2" fill="#f5cba7" />

      {/* Layered Hair Bangs */}
      <rect x="8" y="9" width="16" height="2" fill="#312e81" />
      <rect x="8" y="11" width="3" height="2" fill="#312e81" />
      <rect x="13" y="10" width="4" height="3" fill="#312e81" />
      <rect x="14" y="12" width="2" height="2" fill="#4338ca" />
      <rect x="21" y="11" width="3" height="2" fill="#312e81" />
      {/* Side Hair Locks */}
      <rect x="7" y="11" width="2" height="7" fill="#312e81" />
      <rect x="23" y="11" width="2" height="7" fill="#312e81" />

      {/* ==================== EXPRESSIONS (EYES, BLUSH, MOUTH) ==================== */}
      {mood === "angry" ? (
        <g>
          {/* Furrowed angry brows */}
          <rect x="9" y="12" width="4" height="1" fill="#141413" />
          <rect x="12" y="13" width="2" height="1" fill="#141413" />
          <rect x="19" y="12" width="4" height="1" fill="#141413" />
          <rect x="18" y="13" width="2" height="1" fill="#141413" />
          {/* Fierce glowing red eyes */}
          <rect x="10" y="14" width="3" height="2" fill="#dc2626" />
          <rect x="10" y="14" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="14" width="3" height="2" fill="#dc2626" />
          <rect x="19" y="14" width="1" height="1" fill="#ffffff" />
          {/* Deep blush */}
          <rect x="8" y="16" width="3" height="1" fill="#fb7185" />
          <rect x="21" y="16" width="3" height="1" fill="#fb7185" />
          {/* Shouting fanged mouth */}
          <rect x="13" y="16" width="6" height="3" fill="#991b1b" />
          <rect x="14" y="16" width="1" height="1" fill="#ffffff" />
          <rect x="17" y="16" width="1" height="1" fill="#ffffff" />
          <rect x="14" y="18" width="4" height="1" fill="#fb7185" />
        </g>
      ) : mood === "party" || mood === "happy" ? (
        <g>
          {/* Joyful curved ^ ^ eyes */}
          <rect x="10" y="14" width="3" height="1" fill="#141413" />
          <rect x="9" y="15" width="1" height="1" fill="#141413" />
          <rect x="13" y="15" width="1" height="1" fill="#141413" />
          <rect x="19" y="14" width="3" height="1" fill="#141413" />
          <rect x="18" y="15" width="1" height="1" fill="#141413" />
          <rect x="22" y="15" width="1" height="1" fill="#141413" />
          {/* Bright rosy cheeks */}
          <rect x="8" y="16" width="3" height="1" fill="#FF8A8A" />
          <rect x="21" y="16" width="3" height="1" fill="#FF8A8A" />
          {/* Open singing :D mouth in party, cute smile in happy */}
          {mood === "party" ? (
            <>
              <rect x="13" y="16" width="6" height="3" fill="#e11d48" />
              <rect x="14" y="16" width="4" height="1" fill="#ffffff" />
              <rect x="14" y="18" width="4" height="1" fill="#fda4af" />
            </>
          ) : (
            <>
              <rect x="14" y="16" width="4" height="1" fill="#e11d48" />
              <rect x="15" y="17" width="2" height="1" fill="#e11d48" />
            </>
          )}
        </g>
      ) : (
        <g>
          {/* Big sparkling anime-pixel eyes (idle) */}
          <rect x="10" y="13" width="3" height="3" fill="#1e1b4b" />
          <rect x="10" y="13" width="1" height="1" fill="#ffffff" />
          <rect x="12" y="15" width="1" height="1" fill="#B8D8F8" />

          <rect x="19" y="13" width="3" height="3" fill="#1e1b4b" />
          <rect x="19" y="13" width="1" height="1" fill="#ffffff" />
          <rect x="21" y="15" width="1" height="1" fill="#B8D8F8" />

          {/* Soft cheeks & cute smile */}
          <rect x="8" y="16" width="2" height="1" fill="#FF8A8A" />
          <rect x="22" y="16" width="2" height="1" fill="#FF8A8A" />
          <rect x="14" y="17" width="4" height="1" fill="#be123c" />
        </g>
      )}

      {/* ==================== GLASSES (TIERS 2 & 4) ==================== */}
      {showEvolutionHat && (tierId === "bookworm" || tierId === "professor") && (
        <g>
          {/* Left lens frame */}
          <rect
            x="9"
            y="12"
            width="5"
            height="1"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="9"
            y="16"
            width="5"
            height="1"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="9"
            y="13"
            width="1"
            height="3"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="13"
            y="13"
            width="1"
            height="3"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          {/* Bridge */}
          <rect
            x="14"
            y="14"
            width="4"
            height="1"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          {/* Right lens frame */}
          <rect
            x="18"
            y="12"
            width="5"
            height="1"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="18"
            y="16"
            width="5"
            height="1"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="18"
            y="13"
            width="1"
            height="3"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
          <rect
            x="22"
            y="13"
            width="1"
            height="3"
            fill={tierId === "professor" ? "#F3C969" : "#B8D8F8"}
          />
        </g>
      )}

      {/* ==================== BODY, HOODIE & DETAILS ==================== */}
      {/* Torso Outline */}
      <rect x="9" y="20" width="14" height="8" fill="#141413" />
      {/* Hoodie Torso Fill */}
      <rect x="10" y="21" width="12" height="6" fill="#4338ca" />
      <rect x="11" y="21" width="10" height="5" fill="#6366f1" />
      {/* Collar / Scarf Accent */}
      <rect x="10" y="20" width="12" height="2" fill="#F3C969" />
      <rect x="11" y="20" width="10" height="1" fill="#fef08a" />
      {/* Hoodie Pocket & Drawstrings */}
      <rect x="12" y="24" width="8" height="2" fill="#3730a3" />
      <rect x="13" y="22" width="1" height="2" fill="#F5EFE6" />
      <rect x="18" y="22" width="1" height="2" fill="#F5EFE6" />

      {/* Tier 4 & 5: Academic Red/Gold Bowtie */}
      {showEvolutionHat && (tierId === "professor" || tierId === "royal") && (
        <g>
          <rect x="13" y="20" width="2" height="2" fill="#FF8A8A" />
          <rect x="15" y="20" width="2" height="2" fill="#F3C969" />
          <rect x="17" y="20" width="2" height="2" fill="#FF8A8A" />
        </g>
      )}

      {/* ==================== ARMS / PAWS ==================== */}
      {mood === "party" ? (
        <>
          {/* Raised cheering arms with golden pom-poms */}
          <g className="bm-chibi-party-arm-l">
            <rect x="5" y="17" width="4" height="4" fill="#141413" />
            <rect x="6" y="18" width="3" height="2" fill="#fde6d0" />
            <rect x="3" y="14" width="4" height="4" fill="#F3C969" />
            <rect x="4" y="15" width="2" height="2" fill="#fef08a" />
          </g>
          <g className="bm-chibi-party-arm-r">
            <rect x="23" y="17" width="4" height="4" fill="#141413" />
            <rect x="23" y="18" width="3" height="2" fill="#fde6d0" />
            <rect x="25" y="14" width="4" height="4" fill="#F3C969" />
            <rect x="26" y="15" width="2" height="2" fill="#fef08a" />
          </g>
        </>
      ) : (
        <>
          <g className={mood === "angry" ? "bm-chibi-arm-l" : ""}>
            <rect x="6" y="21" width="4" height="4" fill="#141413" />
            <rect x="7" y="22" width="3" height="2" fill="#fde6d0" />
            {mood === "angry" && (
              <>
                <rect x="4" y="21" width="2" height="1" fill="#ffffff" />
                <rect x="4" y="23" width="2" height="1" fill="#ffffff" />
              </>
            )}
          </g>
          <g className={mood === "angry" ? "bm-chibi-arm-r" : ""}>
            <rect x="22" y="21" width="4" height="4" fill="#141413" />
            <rect x="22" y="22" width="3" height="2" fill="#fde6d0" />
            {mood === "angry" && (
              <>
                <rect x="26" y="21" width="2" height="1" fill="#ffffff" />
                <rect x="26" y="23" width="2" height="1" fill="#ffffff" />
              </>
            )}
          </g>
        </>
      )}

      {/* ==================== FEET / SHOES ==================== */}
      <rect x="10" y="28" width="5" height="3" fill="#141413" />
      <rect x="11" y="28" width="3" height="2" fill="#312e81" />
      <rect x="11" y="30" width="3" height="1" fill="#F5EFE6" />

      <rect x="17" y="28" width="5" height="3" fill="#141413" />
      <rect x="18" y="28" width="3" height="2" fill="#312e81" />
      <rect x="18" y="30" width="3" height="1" fill="#F5EFE6" />
    </svg>
  );
}
