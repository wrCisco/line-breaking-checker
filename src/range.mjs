/**
 * Copyright (c) 2025 Francesco Martini
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


export class Range {
    #start
    #stop
    #step

    constructor(start, stop, step = 1) {
        for (const n of Array.from(arguments)) {
            if (parseInt(n) !== Number(n)) {
                throw TypeError("Arguments of Range must be integers")
            }
        }
        if (step === 0) {
            throw RangeError("Step can't be 0")
        }
        if (stop === undefined) {
            [start, stop] = [0, start]
        }
        this.#start = start
        this.#stop = stop
        this.#step = step
    }

    get start() {
        return this.#start
    }

    get stop() {
        return this.#stop
    }

    get step() {
        return this.#step
    }

    includes(n) {
        if (this.#step > 0) {
            return n >= this.#start && n < this.#stop && (n - this.#start) % this.#step === 0
        }
        return n <= this.#start && n > this.#stop && (this.#start - n) % (-this.#step) === 0
    }

    get size() {
        let d = this.#step > 0
            ? this.#stop - this.#start
            : this.#start - this.#stop
        if (d <= 0) {
            return 0;
        }
        return Math.ceil(d / Math.abs(this.#step))
    }

    toJSON() {
        return {
            'start': this.#start,
            'stop': this.#stop,
            'step': this.#step
        }
    }

    get [Symbol.toStringTag]() {
        return 'Range(' + this.#start + ', ' + this.#stop + ', ' + this.#step + ')'
    }

    [Symbol.iterator]() {
        let current = this.#start
        let isInRange = this.#step > 0
            ? (n) => n < this.#stop
            : (n) => n > this.#stop

        return {
            next: () => {
                if (isInRange(current)) {
                    const result = { done: false, value: current }
                    current += this.#step
                    return result
                }
                return { done: true }
            },
        }
    }
}
