/**
 * The RTL++ counter template (apps/rtlpp/src/lib/project/templates/src/counter) with the one bug the
 * home page story is about: the wrap compares against MAX - 1. Only the header comment is shortened.
 * The testbench is the template's tb_counter.sv, unchanged.
 */

export const COUNTER_FILE = 'counter.sv'
export const TB_FILE = 'tb_counter.sv'
export const TB_NAME = 'tb_counter'

export const BUG_LINE = 15 // zero based: line 16
export const BUGGY = "            count <= (count == MAX - 1) ? '0 : count + 1'b1;"
export const FIXED = "            count <= (count == MAX) ? '0 : count + 1'b1;"

export const COUNTER_BUGGY = `// Counts from 0 to MAX while en is high, then wraps to 0.
module counter #(
    parameter int WIDTH = 8,
    parameter int MAX = 9
) (
    input  logic             clk,
    input  logic             rst,
    input  logic             en,
    output logic [WIDTH-1:0] count = '0,
    output logic             wrap
);
    always_ff @(posedge clk) begin
        if (rst)
            count <= '0;
        else if (en)
${BUGGY}
    end

    assign wrap = en && (count == MAX);
endmodule`

export const COUNTER_FIXED = COUNTER_BUGGY.replace(BUGGY, FIXED)

export const TB_COUNTER = `\`timescale 1ns/1ps
module tb_counter;
    \`include "rtlpp_check.svh"
    logic clk = 0;
    logic rst = 1;
    logic en = 0;
    logic [7:0] count;
    logic wrap;

    counter #(.WIDTH(8), .MAX(9)) dut (.clk(clk), .rst(rst), .en(en), .count(count), .wrap(wrap));

    always #5 clk = ~clk;

    initial begin
        #100000 $fatal(1, "Timed out");
    end

    // Inputs change on the falling edge, so the design samples them cleanly on the rising edge.
    initial begin
        @(negedge clk);
        \`RTLPP_CHECK(count, 8'd0) $fatal(1, "Reset should hold the count at 0, got %0d", count);
        rst = 0;
        en = 1;
        for (int i = 1; i <= 25; i++) begin
            @(negedge clk);
            \`RTLPP_CHECK(count, i % 10) $fatal(1, "After %0d cycles count is %0d, expected %0d", i, count, i % 10);
            \`RTLPP_CHECK(wrap, (count == 9)) $fatal(1, "wrap is %b with count %0d", wrap, count);
        end
        en = 0;
        @(negedge clk);
        \`RTLPP_CHECK(count, 5) $fatal(1, "count changed while en was low");
        \`RTLPP_CHECK(wrap, 1'b0) $fatal(1, "wrap must be low while en is low");
        rst = 1;
        @(negedge clk);
        \`RTLPP_CHECK(count, 8'd0) $fatal(1, "Reset did not clear the count");
        $display("PASS");
        $finish;
    end
endmodule
`

/** The signals drawn, in order, from the testbench scope. */
export const WAVES = ['clk', 'rst', 'en', 'count', 'wrap'] as const
export type WaveName = (typeof WAVES)[number]
