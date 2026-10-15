/**
 * The RTL++ counter template (apps/rtlpp/src/lib/project/templates/src/counter in zkortam/spiceplusplus):
 * tb_counter.sv unchanged. counter.sv is the home page's recorded one (SHOWCASE.source): the template
 * with line 16 changed, its header comment whole.
 */
import { SHOWCASE } from '@/vendor/rtlpp/site/showcase.generated'

export const COUNTER_FILE = 'counter.sv'
export const TB_FILE = 'tb_counter.sv'
export const TB_NAME = 'tb_counter'

/** The recorded run's counter.sv: the template with line 16 changed. */
export const COUNTER_RECORDED = SHOWCASE.source

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

/** The signals the recorded run draws, in its order, from the testbench scope. */
export const WAVES = ['clk', 'rst', 'en', 'count'] as const
export type WaveName = (typeof WAVES)[number]
