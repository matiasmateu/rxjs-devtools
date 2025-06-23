# RxJS DevTools React Integration

> **Project Status: Under Development**
>
> Note: This project is currently under active development. Only beta versions will be published for now. Features, APIs, and behaviors may change frequently until a stable release is announced.

This package provides a React integration for [RxJS DevTools](../rxjs-devtools-chrome-extension), enabling seamless connection between your React app and the RxJS DevTools Chrome extension. It allows you to:

- Display your app name in the devtools UI
- Detect RxJS and redux-observable usage automatically
- Inject a global hook for communication with the Chrome extension
- Optionally display connection status in your app UI

## Usage

Initialize the devtools integration in your React app as early as possible:

```js
import { initializeRxjsDevtools } from 'rxjs-devtools-react';

initializeRxjsDevtools({ appName: 'MyApp' });
```

# rxjs devtools react connector

> A connector library for monitoring RxJS streams and redux-observable epics in a React app, following the Redux DevTools architecture and communicating with a Chrome extension.

## Table of Contents

* [Introduction](#introduction)
* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Usage](#usage)
* [Architecture](#architecture)
* [API Reference](#api-reference)
* [Development](#development)
* [Contributing](#contributing)
* [License](#license)

## Introduction

`@reefmix/rxjs-devtools-react` is an NPM library designed to integrate seamlessly into a React application. It works as a connection between your RxJS and redux-observable epics to provide real-time monitoring and debugging capabilities in a dedicated Chrome extension, inspired by the architecture of Redux DevTools.

## Features

* Instruments RxJS observables and Redux observables
* Monitors streams, events, and epic flows
* Communicates with a Chrome DevTools extension via `window.postMessage` API
* Lightweight, zero-configuration for basic usage
* Supports custom filtering and serialization of observables

## Prerequisites

* Node.js >= 14
* Yarn 1.x or 2.x
* React 16+ / 17+ / 18+
* RxJS 6.x or 7.x
* redux-observable 1.x

## Installation

*In the context of a Yarn workspace monorepo:*

```bash
# From the root of your workspace
yarn workspace @my-app add @reefmis/rxjs-devtools-react
```

### 2. Launch the Chrome Extension

Install and open the companion Chrome extension. Your application will automatically connect and start streaming rxjs streams, events and epics to the extension.

## API

### initializeRxjsDevtools

```ts
initializeRxjsDevtools(options: { appName: string }): void
```

- **appName**: The name of your app, shown in the devtools UI.
- Automatically detects RxJS and redux-observable usage.
- Injects the global hook for the Chrome extension.
- Registers your app with the devtools.
- Logs connection status to the console for debugging.

## Displaying Connection Status (Optional)

You may display a local status indicator in your app UI (e.g., "Connected to RxJS DevTools" or "Not Connected") by consuming the integration's status API (to be implemented). Communication with the Chrome extension is handled automatically.
