param location string = resourceGroup().location
param foundryName string
param storageName string
param deploymentName string = 'gimme-leave'
param modelName string = 'gpt-4.1-mini'
param modelVersion string = '2025-04-14'
param deploymentSku string = 'GlobalStandard'
param capacity int = 1

resource foundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
 name: foundryName
 location: location
 kind: 'AIServices'
 sku: { name: 'S0' }
 identity: { type: 'SystemAssigned' }
 properties: {
  customSubDomainName: foundryName
  publicNetworkAccess: 'Enabled'
  allowProjectManagement: true
 }
}
resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
 dependsOn: [model]
 parent: foundry
 name: 'gimmeabreak'
 location: location
 identity: { type: 'SystemAssigned' }
 properties: { displayName: 'GimmeABreak'
    description: 'Synthetic workforce leave assistant' }
}
resource model 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
 parent: foundry
 name: deploymentName
 sku: { name: deploymentSku
    capacity: capacity }
 properties: {
  model: { format: 'OpenAI'
    name: modelName
    version: modelVersion }
  versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
 }
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
 name: storageName
 location: location
 sku: { name: 'Standard_LRS' }
 kind: 'StorageV2'
 properties: {
  minimumTlsVersion: 'TLS1_2'
  supportsHttpsTrafficOnly: true
  allowBlobPublicAccess: false
 }
}
output endpoint string = 'https://${foundry.name}.services.ai.azure.com'
output deployment string = model.name
output storageAccount string = storage.name
