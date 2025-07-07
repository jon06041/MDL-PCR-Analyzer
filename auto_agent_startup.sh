#!/bin/bash

# Agent Auto-Startup Script
# Source this file to automatically run onboarding for new agents

export QPCR_PROJECT_PATH="/workspaces/QPCR-S-Curve-Analyzer"

# Function to check if agent needs onboarding
check_agent_onboarding() {
    local session_id="${USER}_$$_$(date +%s)"
    local flag_file="/tmp/.agent_onboarded_${session_id}"
    
    if [ ! -f "$flag_file" ]; then
        echo "🚨 RUNNING AGENT ONBOARDING FOR NEW SESSION..."
        
        if [ -f "${QPCR_PROJECT_PATH}/agent_onboarding.sh" ]; then
            chmod +x "${QPCR_PROJECT_PATH}/agent_onboarding.sh"
            "${QPCR_PROJECT_PATH}/agent_onboarding.sh"
            touch "$flag_file"
        fi
    fi
}

# Auto-run onboarding
check_agent_onboarding

# Set up convenient aliases
alias read-docs='cat "${QPCR_PROJECT_PATH}/Agent_instructions.md"'
alias run-onboarding='${QPCR_PROJECT_PATH}/agent_onboarding.sh'
alias emergency-reset='echo "Call emergencyReset() in the web app before loading history"'
alias project-status='grep -A 10 "Latest Status" "${QPCR_PROJECT_PATH}/Agent_instructions.md"'

echo "🔧 Agent environment configured. Use 'run-onboarding' to re-run setup."
