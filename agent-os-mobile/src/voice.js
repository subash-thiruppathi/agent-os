/**
 * AgentOS Voice-First Ambient Cockpit: Translates acoustic speech input into
 * agent intent commands and generates spoken feedback responses.
 */

export class VoiceCockpit {
  constructor(hub) {
    this.hub = hub;
  }

  interpretVoiceCommand(spokenText) {
    if (!spokenText || typeof spokenText !== 'string') {
      return { recognized: false, spokenReply: "I didn't catch that. Could you repeat?" };
    }

    const cleaned = spokenText.toLowerCase();

    if (cleaned.includes('kill switch') || cleaned.includes('freeze') || cleaned.includes('emergency stop')) {
      this.hub.sentinel.quarantine('global', 'Voice-activated emergency quarantine');
      return {
        recognized: true,
        intent: 'EMERGENCY_KILL_SWITCH',
        spokenReply: 'Emergency kill-switch engaged. All autonomous agent tools have been frozen.'
      };
    }

    if (cleaned.includes('dunning') || cleaned.includes('recover') || cleaned.includes('invoices')) {
      const summary = this.hub.cashhound.runCycle();
      return {
        recognized: true,
        intent: 'CASHHOUND_DUNNING_CYCLE',
        spokenReply: `CashHound executed dunning cycle across ${summary.totalInvoices} accounts. Pipeline is active.`
      };
    }

    if (cleaned.includes('status') || cleaned.includes('health') || cleaned.includes('metrics')) {
      const metrics = this.hub.getGlobalMetrics();
      return {
        recognized: true,
        intent: 'FLEET_STATUS',
        spokenReply: `All ${metrics.activeAgents} autonomous agents are online. Revenue recovered stands at ${metrics.revenueRecovered}.`
      };
    }

    return {
      recognized: true,
      intent: 'GENERAL_INQUIRY',
      spokenReply: `Command recognized: "${spokenText}". Awaiting execution confirmation.`
    };
  }
}
